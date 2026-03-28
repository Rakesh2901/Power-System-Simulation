from flask import Flask,render_template, request, send_from_directory
from flask_cors import CORS
import torch
import torch.nn as nn
from torch_geometric.nn import MessagePassing
import io
from PIL import Image
from torchvision import transforms
from Models.Model import PIGNN
# Importing the Other models
# from Models.Model import OtherModel1

app = Flask(__name__,static_folder='frontend/dist', static_url_path='/')
CORS(app)

@app.route("/",methods=["GET", "POST"])
def home():
    result = None
    if request.method == "POST":
        data = request.form["input data"]
        result = data
    return render_template("index.HTML",result=result)
if __name__ == "__main__":
    app.run(debug=True) 

@app.route("/hello")
def hello_world():
    return "<p>Wassup Rakesh ,Hows the dev going?<p>"

#Load the model
Model = PIGNN()
Model.load_state_dict(torch.load("Backend/Models/PIGNN.pth",map_location=torch.device('cuda' if torch.cuda.is_available() else 'cpu')))
Model.eval()

@app.route("/predict" ,methods=["POST"]) 
def predict():
    data = request.get_json()