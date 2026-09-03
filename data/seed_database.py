"""Create and load a deterministic two-year demo dataset.

Run from the repository root:

    python data/seed_database.py --write-csv --apply

The database replacement is atomic: the old rows are restored automatically if
one of the new rows cannot be inserted.
"""

import argparse
import csv
import random
import sys
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.backend.database import get_postgres_connection


CSV_PATH = Path(__file__).with_name("transactions.csv")
EXPECTED_MONTHS = {(year, month) for year in (2025, 2026) for month in range(1, 13)}


@dataclass(frozen=True)
class SeedTransaction:
    booking_date: date
    counterparty: str
    iban: str
    purpose: str
    amount: Decimal
    category: str
    status: str = "Gebucht"

    def as_database_row(self):
        return (
            self.booking_date,
            self.counterparty,
            self.iban,
            self.purpose,
            self.amount,
            self.category,
            self.status,
        )

    def as_csv_row(self):
        return (
            self.booking_date.isoformat(),
            self.counterparty,
            self.iban,
            self.purpose,
            str(self.amount),
            self.category,
            self.status,
        )


IBANS = {
    "salary": "DE45100100100123456789",
    "rent": "DE12500105170648489890",
    "utilities": "DE12300200300011223344",
    "phone": "DE22300200300445566778",
    "spotify": "DE55500105170123411111",
    "netflix": "DE55500105170123456789",
    "gym": "DE88400500000998877665",
    "transport": "DE11200300000123456789",
    "insurance": "DE33200400000554433221",
    "groceries": "DE89370400440532013000",
    "dining": "DE66700800000112233445",
    "household": "DE44500105170987654321",
    "shopping": "DE33500700100876543210",
    "refund": "DE91100100100987654321",
}

GROCERY_STORES = (
    "REWE Markt GmbH",
    "EDEKA Zentrale Stiftung",
    "Lidl Dienstleistung GmbH",
    "ALDI Süd",
)

RESTAURANTS = (
    "Café Morgenrot",
    "Trattoria Milano",
    "Burgermeister GmbH",
    "Sushi House",
)

MONTHLY_SPECIALS = (
    ("OTTO GmbH", "Winterkleidung", 65, 135, "Bekleidung", "shopping"),
    ("MediaMarkt", "Kopfhörer und Zubehör", 45, 145, "Elektronik", "shopping"),
    ("DB Vertrieb GmbH", "Wochenendfahrt", 75, 165, "Reisen", "transport"),
    ("Amazon Payments Europe", "Haushaltsbestellung", 35, 115, "Online-Shopping", "shopping"),
    ("IKEA Deutschland", "Möbel und Dekoration", 70, 185, "Wohnen", "household"),
    ("Booking.com", "Sommerurlaub Anzahlung", 260, 480, "Reisen", "shopping"),
    ("Zalando SE", "Sommerkleidung", 55, 140, "Bekleidung", "shopping"),
    ("Eventim Deutschland", "Konzertticket", 45, 110, "Freizeit", "shopping"),
    ("Apotheke am Markt", "Medikamente und Pflege", 18, 58, "Gesundheit", "dining"),
    ("IKEA Deutschland", "Haushalt und Aufbewahrung", 45, 135, "Wohnen", "household"),
    ("Amazon Payments Europe", "Black-Friday-Bestellung", 80, 210, "Online-Shopping", "shopping"),
    ("Galeria", "Weihnachtsgeschenke", 120, 260, "Geschenke", "shopping"),
)


def negative_amount(random_generator, minimum, maximum):
    """Return a negative Decimal amount with exactly two decimal places."""
    value = random_generator.uniform(minimum, maximum)
    return Decimal(f"-{value:.2f}")


def build_transactions():
    """Build realistic but fully synthetic transactions for 2025 and 2026."""
    random_generator = random.Random(20252026)
    transactions = []

    def add(year, month, day, counterparty, iban_key, purpose, amount, category):
        transactions.append(
            SeedTransaction(
                booking_date=date(year, month, day),
                counterparty=counterparty,
                iban=IBANS[iban_key],
                purpose=purpose,
                amount=Decimal(str(amount)),
                category=category,
            )
        )

    for year in (2025, 2026):
        for month in range(1, 13):
            period = f"{month:02d}/{year}"

            if year == 2025:
                salary = "3050.00" if month <= 6 else "3175.00"
                rent = "-1020.00"
                utilities = "-138.00"
            else:
                salary = "3250.00" if month <= 6 else "3380.00"
                rent = "-1060.00"
                utilities = "-146.00"

            add(year, month, 1, "Nordstern Digital GmbH", "salary", f"Gehalt {period}", salary, "Gehalt")
            add(year, month, 2, "Rheinblick Immobilien GmbH", "rent", f"Miete {period}", rent, "Wohnen")
            add(year, month, 3, "Stadtwerke Musterstadt", "utilities", f"Abschlag Strom und Gas {period}", utilities, "Nebenkosten")
            add(year, month, 5, "Vodafone GmbH", "phone", f"Mobilfunkvertrag {period}", "-29.99", "Telekommunikation")
            add(year, month, 6, "Spotify AB", "spotify", f"Premium-Abo {period}", "-10.99", "Unterhaltung")
            add(year, month, 7, "Fitness First GmbH", "gym", f"Mitgliedsbeitrag {period}", "-39.90", "Sport & Freizeit")
            add(year, month, 8, "Netflix International B.V.", "netflix", f"Streaming-Abo {period}", "-17.99", "Unterhaltung")
            add(year, month, 9, "Verkehrsbetriebe Musterstadt", "transport", f"ÖPNV-Monatsticket {period}", "-58.00", "Transport")

            for index, day in enumerate((4, 11, 18, 25)):
                store = GROCERY_STORES[(month + index + year) % len(GROCERY_STORES)]
                amount = negative_amount(random_generator, 38, 94)
                add(year, month, day, store, "groceries", "Lebensmitteleinkauf", amount, "Lebensmittel")

            bakery_amount = negative_amount(random_generator, 5, 13)
            add(year, month, 13, "Bäckerei Müller", "dining", "Frühstück und Backwaren", bakery_amount, "Gastronomie")

            restaurant = RESTAURANTS[(year + month) % len(RESTAURANTS)]
            restaurant_amount = negative_amount(random_generator, 28, 68)
            add(year, month, 22, restaurant, "dining", "Restaurantbesuch", restaurant_amount, "Gastronomie")

            household_amount = negative_amount(random_generator, 18, 48)
            add(year, month, 16, "dm-drogerie markt", "household", "Drogerie und Haushalt", household_amount, "Drogerie & Haushalt")

            special = MONTHLY_SPECIALS[month - 1]
            counterparty, purpose, minimum, maximum, category, iban_key = special
            special_amount = negative_amount(random_generator, minimum, maximum)
            add(year, month, 27, counterparty, iban_key, purpose, special_amount, category)

            if month in (1, 4, 7, 10):
                insurance_amount = "-82.50" if year == 2025 else "-86.90"
                add(year, month, 10, "Allianz Versicherungs-AG", "insurance", f"Versicherungsbeitrag Q{(month - 1) // 3 + 1}/{year}", insurance_amount, "Versicherungen")

            if month in (3, 8, 11):
                sale_amount = Decimal(f"{random_generator.uniform(45, 145):.2f}")
                add(year, month, 20, "Kleinanzeigen Käufer", "refund", "Verkauf Gebrauchtware", sale_amount, "Gutschrift")

            if month == 11:
                bonus = "750.00" if year == 2025 else "900.00"
                add(year, month, 28, "Nordstern Digital GmbH", "salary", f"Jahresbonus {year}", bonus, "Bonus")

    return sorted(transactions, key=lambda transaction: transaction.booking_date)


def validate_transactions(transactions):
    """Fail early if the generated dataset does not cover both full years."""
    covered_months = {
        (transaction.booking_date.year, transaction.booking_date.month)
        for transaction in transactions
    }
    missing_months = EXPECTED_MONTHS - covered_months

    if missing_months:
        raise ValueError(f"Missing seed months: {sorted(missing_months)}")

    duplicate_rows = len(transactions) - len(
        {transaction.as_database_row() for transaction in transactions}
    )
    if duplicate_rows:
        raise ValueError(f"Generated dataset contains {duplicate_rows} duplicates.")


def calculate_summary(transactions):
    income = sum(
        (transaction.amount for transaction in transactions if transaction.amount > 0),
        Decimal("0"),
    )
    expenses = abs(
        sum(
            (transaction.amount for transaction in transactions if transaction.amount < 0),
            Decimal("0"),
        )
    )
    return income, expenses, income - expenses


def write_csv(transactions):
    """Replace the tracked example CSV with the generated seed dataset."""
    with CSV_PATH.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file, delimiter=";")
        writer.writerow(
            (
                "Datum",
                "Empfänger_Sender",
                "IBAN",
                "Verwendungszweck",
                "Betrag_EURO",
                "Kategorie",
                "Status",
            )
        )
        writer.writerows(transaction.as_csv_row() for transaction in transactions)


def replace_database_transactions(transactions):
    """Atomically replace only the rows in public.transactions."""
    connection = get_postgres_connection()
    if connection is None:
        raise ConnectionError("Could not connect to PostgreSQL.")

    insert_query = """
        INSERT INTO public.transactions (
            datum,
            empfaenger_sender,
            iban,
            verwendungszweck,
            betrag_euro,
            kategorie,
            status
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s);
    """

    try:
        with connection.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE public.transactions RESTART IDENTITY;")
            cursor.executemany(
                insert_query,
                [transaction.as_database_row() for transaction in transactions],
            )
            cursor.execute("SELECT COUNT(*) FROM public.transactions;")
            inserted_count = cursor.fetchone()[0]

        if inserted_count != len(transactions):
            raise RuntimeError(
                f"Expected {len(transactions)} rows, but inserted {inserted_count}."
            )

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Replace all rows in public.transactions with the seed dataset.",
    )
    parser.add_argument(
        "--write-csv",
        action="store_true",
        help="Replace data/transactions.csv with the same seed dataset.",
    )
    arguments = parser.parse_args()

    transactions = build_transactions()
    validate_transactions(transactions)
    income, expenses, balance = calculate_summary(transactions)

    print(f"Prepared {len(transactions)} synthetic transactions.")
    print("Covered period: 2025-01 through 2026-12 (24 months).")
    print(f"Income: {income:.2f} EUR")
    print(f"Expenses: {expenses:.2f} EUR")
    print(f"Balance: {balance:.2f} EUR")

    if arguments.write_csv:
        write_csv(transactions)
        print(f"CSV written to {CSV_PATH}")

    if arguments.apply:
        replace_database_transactions(transactions)
        print("Database transactions replaced successfully.")

    if not arguments.apply and not arguments.write_csv:
        print("Preview only. Use --write-csv and/or --apply to make changes.")


if __name__ == "__main__":
    main()
