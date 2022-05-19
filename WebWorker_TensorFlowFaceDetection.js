importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js")
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface")

var model 
let canvas
let ctx
var is_valid = false

// load model
const setup = async () => {

    try {
        model = await blazeface.load({maxFaces:1});
        model.estimateFaces(canvas)
                                    
        postMessage({ modelIsReady: true});

    } catch(err){
        console.error("Can't load model: ", err)
    }
}
// setup();

async function predict(img, width, height) {
    // Use model to estimate faces

    canvas.width = width
    canvas.height = height
    // ctx.putImageData(img,0,0)
    // ctx.clearRect(0, 0, canvas.width, canvas.height);


    const returnTensors = false;
    const flipHorizontal = false;
    const annotateBoxes = true;
    const predictions =  await model.estimateFaces(img, returnTensors, flipHorizontal, annotateBoxes);

    //send predictions to main thread 
    // console.log(predictions)
    // postMessage(predictions)

    let topLef_box = [canvas.width/4, canvas.height/8];
    let size_box = [canvas.width/2, canvas.height - canvas.height/4];
    let bottomRight_box = [canvas.width/4+canvas.width/2, canvas.height/8+canvas.height - canvas.height/4];
    
    let area_box = (bottomRight_box[0] - topLef_box[0]) * (bottomRight_box[1] - topLef_box[1]);
    
    // console.log(predictions[0].topLeft)

    if (predictions.length == 1) {
        start = predictions[0].topLeft;
        end = predictions[0].bottomRight;
        size = [end[0] - start[0], end[1] - start[1]];
        area = (end[0]-start[0])*(end[1]-start[1]);

        // console.log(area_box, area);

        if (start[0]>= topLef_box[0] && start[1] >= topLef_box[1] && end[0] <= bottomRight_box[0] && end[1] <= bottomRight_box[1]) {
            
            if (area >= 0.2*area_box && area <= 0.55*area_box) {
                                
                ctx.strokeStyle = "green"; 
                is_valid = true
        
            } else {
                ctx.strokeStyle = "red"; 
                is_valid = false
            }
            

        } else {
            ctx.strokeStyle = "red"; 
            is_valid = false
        }
        
        ctx.beginPath();
        ctx.lineWidth = 10
        ctx.rect(topLef_box[0], topLef_box[1], size_box[0],size_box[1]);
        ctx.stroke();         
    }


    postMessage({ "valid" : is_valid,})
}

onmessage = function (event) {

    if (event.data.msg == 'init'){
        canvas = event.data.canvas;
        ctx =  canvas.getContext('2d')
        setup()
    }

    if (model) {

        // console.log("from worker =" + event.data.number)
        // const img = new ImageData(event.data.data, event.data.width, event.data.height)
        
        const img = new ImageData(
            new Uint8ClampedArray(event.data.data),
            event.data.width, 
            event.data.height)

        predict(img, event.data.width, event.data.height);
    }
}