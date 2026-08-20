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

def print_dataframe(df):
    """
    Prints the DataFrame in a readable format.
    
    Parameters:
        df (pd.DataFrame): The DataFrame to print.
    """

    # print if there are duplicate rows in the DataFrame
    df_duplicates = df.duplicated().sum()

    # print which are duplicate rows in the DataFrame
    df_duplicate_rows = df[df.duplicated(keep=False)]

    # calculate total income
    total_income = df[df['Betrag_EUR'] > 0]['Betrag_EUR'].sum()

    # calculate total expensenes
    total_expenses = df[df['Betrag_EUR'] < 0]['Betrag_EUR'].sum()

    # calculate saldo
    saldo = total_income + total_expenses

    # print if there are missing cells in the DataFrame
    df_missing = df.isnull().sum()
    print(df)
    print(df.columns)
    print(df.shape)
    
    df.info()
    print(df['Datum'].head())
    print(type(df['Datum'].iloc[0]))

    print(df_missing)
    
    print(df_duplicates)
    print(df_duplicate_rows)


    print(total_income)
    print(abs(total_expenses))
    print(saldo)

print_dataframe(read_csv('data/transactions.csv'))

