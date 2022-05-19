const progress = document.getElementById("progress");
const timer = document.getElementById("timer");
const video = document.getElementById("video");
const button = document.getElementById("play");
const selector = document.getElementById("select")

const canvasCounter = document.getElementById("canvas_counter");
const ctxCounter = canvasCounter.getContext('2d')


const canvasSquare = document.getElementById("canvas_square");
const offscreenCanvas = canvasSquare.transferControlToOffscreen();

const canvasLocal = document.createElement('canvas')
const ctxLocal = canvasLocal.getContext('2d')

let currentStream // This variable carries a pointer to the audio/video stream so that it can be canceled or stopped
let currentDevice // This variable carries information about the current audio and video device 
let interval_seconds // this variable carries a pointer to a counter, that counter will run for the duration of the test -- see max_duration_counter
let webWorker // this variable carries a pointer to the webworker where the face localization will be performed
var workerModelIsReady = false // this variable will inform if the model is ready in the webworker || false -> Model not ready  | true -> model ready
var isRunning = true // this variable can be used to stop the processing of the stream if needed 

var timeKeeper = 0 // this variables counts for the duration of the test
const max_duration_counter = 8 // this variable set the duration of the test || Should we import this information from the dashboard? 
const FramesSkipped = 5 // this variable set the number of frames skipped during video processing. Five (5) frames seems to be a good compromise between performance and smoothness 

var time0 = performance.now()
var time1 = null
var fps = null
var fpsAccumulator = []
var isValidAccumulator = []
var isValid = false
var frameSkipper = 0

// variable that defines video constraints 
var videoConstraints =  { frameRate: { ideal: 30, max: 60 },
                          width: 1280, //{ min: 640, ideal: 1280, max: 1280 },
                          height: 720, // { min: 480, ideal: 720, max: 720 },
                          facingMode: "user" ,} ;

// variable that defines audio constraints
var audioConstraints = { video: false,
                            audio : {
                                "sampleSize": 16,
                                "channelCount": 2,
                                "echoCancellation": false,
                                "sampleRate": 48000,
                                "noiseSuppression": true,
                                "enabled" : false,
                            } };
                                 

// variable that carries test results || this variable can be exported 
var outputTest = {  
                deviceIdVideo : null,
                deviceIdAudio : null,
                frameWidth : null,
                frameHeight : null,
                fpsProcessor : null,
                fpsCamera : null,
                headinFrame : null,
            }


// function to compute the average
const average = (array) => array.reduce((a, b) => a + b) / array.length;

function setupCamera (){

    const constraints = {
        video: videoConstraints,
        audio: audioConstraints, 
      };

    navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream){
        currentStream = stream
        const videoTracks = stream.getVideoTracks();
        currentDevice = videoTracks[0].label

        video.srcObject = stream;
        for(var i = 0; i < selector.length; i++) {
            if (currentDevice == selector[i].innerHTML) {

                selector[i].selected = true
            }          
        }       
    })
    .catch (e => console.log(e));
}


const setupModel = async function() {

    if (window.Worker) {
        // create webworker
        webWorker = new Worker('WebWorker_TensorFlowFaceDetection.js')
        // send canvas
        webWorker.postMessage({msg: 'init', canvas: offscreenCanvas}, [offscreenCanvas]);
        
        webWorker.onmessage = event => {
            
            if (!workerModelIsReady) {

                if (event.data.modelIsReady) {
                    workerModelIsReady = true
                    button.disabled = false
                }
            }
            
            if (typeof event.data.valid !== 'undefined') {
                isValid = event.data.valid // boolean variable emitted by the web informing if the subject is in the correct position of the frame or no
            }
            
            }
        }
    }


    
const detectFaces = async () => {

    frameSkipper+=1 // this counter identifies if a frame should be sent to the webWorker or not. 

    // Draw video steam in a canvas and send it to worker -- The canvasLocal is not painted on the screen 
    canvasLocal.width = video.videoWidth;
    canvasLocal.height = video.videoHeight;
    ctxLocal.clearRect(0, 0, canvasLocal.width, canvasLocal.height);
    ctxLocal.drawImage(video, 0,0, canvasLocal.width, canvasLocal.height);
    const imgData = ctxLocal.getImageData(0, 0, canvasLocal.width, canvasLocal.height)

    // send the frame to the worker every 5 frames || this number can be adjusted  
    if (frameSkipper == FramesSkipped) {
        if (workerModelIsReady) {
            webWorker.postMessage({
                "msg": "frame",
                "data": imgData.data.buffer,
                "width": canvasLocal.width,
                "height": canvasLocal.height,
            }, [imgData.data.buffer])
        }
        frameSkipper = 0
    }
    
    

    time1 = performance.now();
    fps = Math.round((time1-time0));
    time0 = time1;
    if (button.disabled == true) {
        fpsAccumulator.push(fps)
        isValidAccumulator.push(+isValid) // isValid is a boolean, adding the + transforms it to an in || false -> 0 | true -> 1  
        }


    if (isRunning){
        window.requestAnimationFrame(detectFaces);
    }


}


function drawCounter(counter) {

    canvasCounter.width = video.videoWidth;
    canvasCounter.height = video.videoHeight;
    ctxCounter.clearRect(0, 0, canvasCounter.width, canvasCounter.height);

    if (timeKeeper<= 3 && timeKeeper<= max_duration_counter) {
        ctxCounter.beginPath();
        ctxCounter.font = '200px arial';
        ctxCounter.strokeStyle = "#30C5FF";
        ctxCounter.fillStyle = "#30C5FF"; //<======= here
        ctxCounter.textBaseline = 'middle';
        ctxCounter.textAlign = "center";
        ctxCounter.fillText(3 - timeKeeper ,canvasCounter.width/2, canvasCounter.height/2);
        ctxCounter.arc(canvasCounter.width/2, canvasCounter.height/2, 150, 0, 2 * Math.PI);
        ctxCounter.lineWidth=5
        ctxCounter.stroke(); 
        timeKeeper+=1

    } else if (timeKeeper > 3 && timeKeeper<= max_duration_counter){
            progress.value = Math.round(((timeKeeper-3)/(max_duration_counter-3))*100);
            // timer.innerHTML = mytime + " seconds" ;
    
            timeKeeper+=1
    } else  {
             
            // the time is up -- reset the counter, clean the timer, and provide results
            button.disabled = false
            progress.value = 0;
            timeKeeper = 0
            clearInterval(interval_seconds)


            outputTest.deviceId = currentStream.getVideoTracks()[0].getSettings().deviceId
            outputTest.fpsCamera = currentStream.getVideoTracks()[0].getSettings().frameRate
            outputTest.frameHeight = currentStream.getVideoTracks()[0].getSettings().height
            outputTest.frameWidth = currentStream.getVideoTracks()[0].getSettings().width
    
            outputTest.fpsProcessor = Math.round((1/average(fpsAccumulator.slice(1)))*1000)  // find the average FPS || .slice(1) return a new array starting from index 1
            outputTest.headinFrame = Math.round(average(isValidAccumulator)*100)
    
       
            localStorage.setItem('OutputVideoTest', JSON.stringify(outputTest))
            location.replace("./table.html")
    
    }

}


setupCamera()
video.addEventListener("loadeddata", async () => {
    button.disabled = true;
    setupModel();
    detectFaces();
})

button.addEventListener("click", function() {
    timeKeeper = 0 
    button.disabled  = true
    drawCounter()
    interval_seconds = setInterval(drawCounter, 1000)

})