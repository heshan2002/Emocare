# preprocess_fer2013.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

csv_path = "data/fer2013.csv"  # adjust if located in data/fer2013/fer2013.csv

df = pd.read_csv(csv_path)

def pixels_to_array(pixels_str):
    arr = np.fromstring(pixels_str, sep=' ', dtype=np.uint8)
    return arr.reshape(48,48)

X, y = [], []
for _, row in df.iterrows():
    X.append(pixels_to_array(row['pixels']))
    y.append(int(row['emotion']))

X = np.stack(X).astype('float32') / 255.0
X = np.expand_dims(X, -1)  # shape (N,48,48,1)
y = np.array(y)

X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, stratify=y_temp, random_state=42)

import numpy as np
np.save('X_train.npy', X_train)
np.save('X_val.npy', X_val)
np.save('X_test.npy', X_test)
np.save('y_train.npy', y_train)
np.save('y_val.npy', y_val)
np.save('y_test.npy', y_test)

print("Saved numpy arrays. Shapes:", X_train.shape, X_val.shape, X_test.shape)
