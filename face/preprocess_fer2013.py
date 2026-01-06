import pandas as pd
import numpy as np
import os

DATASET = "fer2013.csv"
OUT_DIR = "processed"

os.makedirs(OUT_DIR, exist_ok=True)

data = pd.read_csv(DATASET)

X = []
y = []

for _, row in data.iterrows():
    pixels = np.array(row["pixels"].split(), dtype="float32")
    pixels = pixels.reshape(48, 48)
    X.append(pixels)
    y.append(row["emotion"])

X = np.array(X) / 255.0
y = np.array(y)

np.save(os.path.join(OUT_DIR, "X.npy"), X)
np.save(os.path.join(OUT_DIR, "y.npy"), y)

print("FER2013 preprocessing completed")
