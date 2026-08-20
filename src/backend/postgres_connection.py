def get_postgres_connection():
    """
    Establishes a connection to the PostgreSQL database using the provided configuration.

    Returns:
        connection: A psycopg2 connection object to the PostgreSQL database.
    """
    import psycopg2
    from psycopg2 import OperationalError

    # Database configuration parameters
    db_config = {
        'dbname': 'your_database_name',
        'user': 'your_username',
        'password': 'your_password',
        'host': 'localhost',  # or your database host
        'port': '5432'        # default PostgreSQL port
    }

    try:
        # Establishing the connection
        connection = psycopg2.connect(**db_config)
        print("Connection to PostgreSQL database established successfully.")
        return connection
    except OperationalError as e:
        print(f"Error: Could not connect to the PostgreSQL database. {e}")
        return None


    