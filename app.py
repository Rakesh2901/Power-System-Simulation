from flask import Flask,render_template, request
app = Flask(__name__)

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
    return "<p>Wassup Rakesh<p>"