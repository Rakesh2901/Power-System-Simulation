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
│
├── app.py                 # Main Flask/FastAPI application entry point
├── requirements.txt       # Project dependencies
├── Procfile               # Deployment configuration (e.g., for Heroku)
│
├── model/                 # Model storage
│   └── PIGNN.pth          # Trained PyTorch model weights
│   └── LSTM.pth 
│
├── utils/                 # Helper functions
│   └── simulate.py        # Power system simulation logic
│
├── templates/             # HTML files
│   └── index.html         # Main dashboard/UI
│
└── static/                # Static assets
    ├── plot.png           # Generated simulation plots
    ├── css/               # Stylesheets
    └── js/                # Frontend scripts
