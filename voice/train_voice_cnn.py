import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Dense, Flatten, Dropout
from tensorflow.keras.utils import to_categorical

X = np.load("X_voice.npy")
y = np.load("y_voice.npy")

X = X.reshape(X.shape[0], X.shape[1], 1)
y = to_categorical(y)

model = Sequential([
    Conv1D(64, 3, activation='relu', input_shape=(40,1)),
    MaxPooling1D(2),
    Conv1D(128, 3, activation='relu'),
    MaxPooling1D(2),
    Flatten(),
    Dense(128, activation='relu'),
    Dropout(0.5),
    Dense(8, activation='softmax')
])

model.compile(optimizer='adam',
              loss='categorical_crossentropy',
              metrics=['accuracy'])

model.fit(X, y, epochs=15, batch_size=32)
model.save("voice_cnn_best.h5")

print("Voice CNN trained")
