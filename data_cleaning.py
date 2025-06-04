import pandas as pd          # I use pandas for dataframes
import numpy as np           # I rely on numpy for numeric helpers
from pathlib import Path     # I work with file paths easily

# Tunable thresholds for cleaning
zTH = 0.90      # I drop columns where 90% or more of values are zero
nTH = 0.50      # I drop columns where 50% or more of values are NaN

# Paths setup
base   = Path(__file__).resolve().parent      # I define project root (Capstone_478)
rawDir = base                                 # I know raw CSV sits here
outDir = base / "clean"                     # I plan to place cleaned file here
outDir.mkdir(exist_ok=True)                   # I ensure the output directory exists

rawFile = rawDir / "merged_file_unique.csv"   # original input CSV file
outFile = outDir / "merged_file_clean.csv"    # final cleaned CSV file

# Load data
print("Loading data from", rawFile)           # I inform user about loading process
d = pd.read_csv(rawFile)                       # I read the raw CSV into a DataFrame
print(f"Loaded {len(d)} rows and {d.shape[1]} columns")

# Identify numeric columns
nums = d.select_dtypes(include=[np.number]).columns  # I pick numeric-type columns
print(f"Found {len(nums)} numeric columns")

# Determine which columns to drop
bye = []  # I will list columns to remove
for c in nums:
    zero_rate = (d[c] == 0).mean()  # I compute fraction of zeros
    nan_rate  = d[c].isna().mean()   # I compute fraction of NaNs
    # decide if this column is uninformative
    if zero_rate >= zTH or nan_rate >= nTH:
        bye.append(c)
print(f"Dropping {len(bye)} columns → {bye}")  # I report dropped columns

# Drop uninformative columns and any remaining NaN rows
d2 = d.drop(columns=bye)                   # I drop the flagged columns
pre_rows = len(d2)                          # I store the row count before NaN removal

d2 = d2.dropna()                            # I drop any rows containing NaN values
removed_rows = pre_rows - len(d2)           # I calculate how many rows were removed
print(f"Removed {removed_rows} rows with missing data")  # I report dropped rows

# Save cleaned data
d2.to_csv(outFile, index=False)             # I export the cleaned DataFrame to CSV
print("Saved cleaned data to", outFile)    # I confirm successful save

# Summarize final dataset
cats = d2.select_dtypes(exclude=[np.number]).columns  # I find categorical columns
cont = d2.select_dtypes(include=[np.number]).columns   # I find continuous columns
print("--- Final Summary ---")
print(f"Final rows   : {len(d2)}")
print(f"Categorical  : {len(cats)}, Sample→ {list(cats)[:8]}")  # I list example categories
print(f"Continuous   : {len(cont)}, Sample→ {list(cont)[:8]}")  # I list example continuous

# Done cleaning!  Drama free end.