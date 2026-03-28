## Project Title: **Physics Informed Neural Network for power system**
## 🚧 Project Status: Work in Progress (WIP)
Current Focus: Implementing Physics-Informed loss functions for the GNN.

## 📌 Overview
**Simulate, Visualize, and Optimize Power Grids with PIGNNs**
Integrating physics-based constraints with Graph Neural Networks to provide high-fidelity power system simulations and automated grid topology optimization.


### 🛠️ Installation
1. Clone the repository
2. Create a virtual environment: `python -m venv venv`
3. Activate it:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`

## 📂 Project Structure

```text
power-system-Simulation/
│
├── ├── Backend/
│   ├── Models/
│   │   ├── Model.py
│   │   ├── LSTM.pth
│   │   └── PIGNN.pth
│   └── app.py
├── Frontend/
│   ├── static/
│   ├── templates/
│   └── App.jsx
├── .flaskenv
├── requirements.txt
└── README.md
