import pandas as pd

def read_csv(file_path):
    """
    Reads a CSV file and returns a pandas DataFrame.
    
    Parameters:
        file_path (str): The path to the CSV file.
    
    Returns:
        pd.DataFrame: The loaded DataFrame.
    """
    return pd.read_csv(file_path, sep=';', encoding='utf-8', parse_dates=['Datum'])


def validate_csv(df):
    """
    Validates the DataFrame for required columns and data types.
    
    Parameters:
        df (pd.DataFrame): The DataFrame to validate.

    Returns:
        bool: True if the DataFrame is valid, False otherwise.
    """
    required_columns = ['Datum', 'Betrag_EUR', 'Kategorie', 'Status', 'Empfänger_Sender', 'Verwendungszweck', 'IBAN']
    for column in required_columns:
        if column not in df.columns:
            return False
    if not pd.api.types.is_numeric_dtype(df['Betrag_EUR']):
        return False
    if not pd.api.types.is_datetime64_any_dtype(df['Datum']):
        return False
    if not pd.api.types.is_string_dtype(df['Kategorie']):
        return False
    if not pd.api.types.is_string_dtype(df['Status']):
        return False
    if not pd.api.types.is_string_dtype(df['Empfänger_Sender']):
        return False
    if not pd.api.types.is_string_dtype(df['Verwendungszweck']):
        return False
    return True


def calculate_financial_summary(df):
    """
    Calculates a financial summary from the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame containing transaction data.

    Returns:
        dict: A dictionary containing total income, total expenses, and saldo.
    """
    total_income = calculate_total_income(df)
    total_expenses = calculate_total_expenses(df)
    saldo = calculate_saldo(df)
    return {
        'total_income': total_income,
        'total_expenses': total_expenses,
        'saldo': saldo
    }



def calculate_total_income(df):
    """
    Calculates the total income from the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame containing transaction data.

    Returns:
        float: The total income.

    """
    return df[df['Betrag_EUR'] > 0]['Betrag_EUR'].sum()


def calculate_total_expenses(df):
    """
    Calculates the total expenses from the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame containing transaction data.

    Returns:
        float: The total expenses.

    """
    return abs(df[df['Betrag_EUR'] < 0]['Betrag_EUR'].sum())


def calculate_expenses_per_category(df):
    """
    Calculates the total expenses per category from the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame containing transaction data.

    Returns:
        pd.Series: A Series with categories as index and total expenses as values.

    """
    return abs(df[df['Betrag_EUR'] < 0].groupby('Kategorie')['Betrag_EUR'].sum())


def calculate_saldo(df):
    """
    Calculates the saldo (total income - total expenses) from the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame containing transaction data.

    Returns:
        float: The saldo.

    """
    total_income = calculate_total_income(df)
    total_expenses = calculate_total_expenses(df)
    return total_income - total_expenses


def calculate_missing_cells(df):
    """
    Returns the number of missing cells in the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame to check for missing cells.

    Returns:
        pd.Series: A Series with column names as index and number of missing cells as values.

    """
    return df.isnull().sum()


def calculate_duplicate_rows(df):
    """
    Returns the duplicate rows in the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame to check for duplicate rows.

    Returns:
        pd.DataFrame: A DataFrame containing the duplicate rows.

    """
    return df[df.duplicated(keep=False)]

def calculate_duplicate_count(df):
    """
    Returns the number of duplicate rows in the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame to check for duplicate rows.

    Returns:
        int: The number of duplicate rows.

    """
    return df.duplicated().sum()

def calculate_expenses_per_month(df, month, year):
    """
    Calculates the total expenses for a specific month and year from the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame containing transaction data.
        month (int): The month for which to calculate expenses (1-12).
        year (int): The year for which to calculate expenses.

    Returns:
        float: The total expenses for the specified month and year.

    """
    filtered_df = df[(df['Datum'].dt.month == month) & (df['Datum'].dt.year == year)]
    return abs(filtered_df[filtered_df['Betrag_EUR'] < 0]['Betrag_EUR'].sum())

def calculate_expenses_for_all_months(df):
    """
    Calculates the total expenses for each month in the DataFrame.
    
    Parameters:
        df (pd.DataFrame): The DataFrame containing transaction data.

    Returns:
        pd.Series: A Series with (year, month) as index and total expenses as values.

    """
    expenses = df[df['Betrag_EUR'] < 0]

    return abs(
        expenses.groupby(
            expenses['Datum'].dt.to_period('M')
        )['Betrag_EUR'].sum()
    )

if __name__ == "__main__":
    file_path = 'C:\\Users\\Tarik\\Desktop\\Dateien\\Code\\fullstack-finance-dashboard\\data\\transactions.csv'
    df = read_csv(file_path)
    
    if validate_csv(df):
        summary = calculate_financial_summary(df)
        print("Financial Summary:", summary)
        
        expenses_per_category = calculate_expenses_per_category(df)
        print("Expenses per Category:\n", expenses_per_category)
        
        missing_cells = calculate_missing_cells(df)
        print("Missing Cells:\n", missing_cells)
        
        duplicate_rows = calculate_duplicate_rows(df)
        print("Duplicate Rows:\n", duplicate_rows)
        
        duplicate_count = calculate_duplicate_count(df)
        print("Number of Duplicate Rows:", duplicate_count)
        
        expenses_per_month = calculate_expenses_per_month(df, 8, 2026)
        print("Expenses for August 2026:", expenses_per_month)

        expenses_for_all_months = calculate_expenses_for_all_months(df)
        print("Expenses for All Months:\n", expenses_for_all_months)
    else:
        print("CSV file is not valid.")