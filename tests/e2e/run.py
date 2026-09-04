"""Own the temporary PostgreSQL/database lifecycle around Playwright."""

from contextlib import contextmanager
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from database import seed

ROOT = Path(__file__).resolve().parents[2]
PROCESS_FLAGS = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0


def run_command(arguments):
    # A PostgreSQL child can inherit PIPE handles on Windows and keep communicate()
    # waiting after pg_ctl exits. A file avoids that inherited-pipe deadlock.
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace") as output:
        result = subprocess.run(arguments, stdout=output, stderr=subprocess.STDOUT,
                                timeout=60, creationflags=PROCESS_FLAGS)
        if result.returncode:
            output.seek(0)
            raise subprocess.CalledProcessError(result.returncode, arguments, output=output.read())
        return result


def postgres_bin():
    if os.getenv("E2E_PG_BIN"):
        return Path(os.environ["E2E_PG_BIN"])
    executable = shutil.which("pg_ctl")
    if executable:
        return Path(executable).parent
    if os.name == "nt":
        installation = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "PostgreSQL"
        candidates = [folder for folder in installation.glob("*") if folder.name.isdigit()]
        for folder in sorted(candidates, key=lambda item: int(item.name), reverse=True):
            if (folder / "bin" / "pg_ctl.exe").exists():
                return folder / "bin"
    raise RuntimeError("PostgreSQL tools not found. Set E2E_PG_BIN or E2E_POSTGRES_URL (see README).")


@contextmanager
def postgres_instance():
    external_url = os.getenv("E2E_POSTGRES_URL")
    if external_url:
        info = conninfo_to_dict(external_url)
        if (info.get("dbname") != "postgres"
                or info.get("host") not in ("localhost", "127.0.0.1", "::1")
                or not all(info.get(key) for key in ("user", "password", "port"))
                or set(info) - {"dbname", "host", "port", "user", "password"}):
            raise ValueError("E2E_POSTGRES_URL must explicitly target a local postgres admin database.")
        yield info
        return

    binaries = postgres_bin()
    suffix = ".exe" if os.name == "nt" else ""
    with tempfile.TemporaryDirectory(prefix="finance-dashboard-e2e-") as directory:
        temporary = Path(directory)
        cluster = temporary / "pgdata"
        password = secrets.token_hex(24)
        password_file = temporary / "password"
        password_file.write_text(password, encoding="utf-8")
        password_file.chmod(0o600)
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        run_command([str(binaries / f"initdb{suffix}"), "-D", str(cluster),
                     "-U", "finance_e2e", "--auth=scram-sha-256", "--encoding=UTF8",
                     "--locale=C", f"--pwfile={password_file}"])
        pg_ctl = str(binaries / f"pg_ctl{suffix}")
        started = False
        try:
            run_command([pg_ctl, "-D", str(cluster), "-l", str(temporary / "postgres.log"),
                         "-o", f"-h 127.0.0.1 -p {port}", "-w", "start"])
            started = True
            print("Started isolated, password-protected PostgreSQL on loopback.", flush=True)
            yield {"host": "127.0.0.1", "port": str(port), "dbname": "postgres",
                   "user": "finance_e2e", "password": password}
        finally:
            if started or (cluster / "postmaster.pid").exists():
                run_command([pg_ctl, "-D", str(cluster), "-m", "fast", "-w", "stop"])
                print("Stopped temporary PostgreSQL; its temporary files will be removed.", flush=True)


def main():
    # Never consult .env, DB_* or DATABASE_URL to choose a database.
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    run_id = uuid4().hex
    database_name = f"finance_e2e_{run_id}"
    with postgres_instance() as admin_info:
        created = False
        try:
            with psycopg.connect(**admin_info, autocommit=True, connect_timeout=5) as admin:
                admin.execute(sql.SQL("CREATE DATABASE {} TEMPLATE template0").format(sql.Identifier(database_name)))
            created = True
            os.environ["E2E_RUN_ID"] = run_id
            os.environ["E2E_DATABASE_URL"] = make_conninfo(**{**admin_info, "dbname": database_name})
            seed()
            print(f"Created disposable test database: {database_name}", flush=True)
            command = [shutil.which("node") or "node", str(ROOT / "frontend/node_modules/@playwright/test/cli.js"),
                       "test", "--config", str(ROOT / "frontend/playwright.config.js"), *sys.argv[1:]]
            return subprocess.run(command, cwd=ROOT / "frontend", stdout=sys.stdout,
                                  stderr=sys.stderr, creationflags=PROCESS_FLAGS).returncode
        finally:
            if created:
                # Only this randomly generated database, only after our successful CREATE.
                with psycopg.connect(**admin_info, autocommit=True, connect_timeout=5) as admin:
                    admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))
                print(f"Removed disposable test database: {database_name}", flush=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, psycopg.Error, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        # Do not print DSNs, generated passwords or inherited environment variables.
        if isinstance(error, (RuntimeError, ValueError)):
            print(str(error), file=sys.stderr)
        elif isinstance(error, subprocess.CalledProcessError):
            print(f"PostgreSQL command failed: {Path(error.cmd[0]).name}", file=sys.stderr)
            print(error.stderr or error.stdout, file=sys.stderr)
        else:
            print(f"E2E infrastructure failed ({type(error).__name__}). Check PostgreSQL tools and ports.", file=sys.stderr)
        raise SystemExit(1)
