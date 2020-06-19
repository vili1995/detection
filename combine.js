let video;

let poseNet;
let pose;
let poseLabel;
let skeleton;

let wisdom;

let detector;
let detectedObjects;

let intersection = [];
let timeout_pose = 500;
let timeout_detector = 500;

let updateHTMLEveryMS = 3000; // 3 sec
let clock = new Date().getTime();

let timer;

let result_table;
let limit_table_row = 10;

function setup() {
  canvas = createCanvas(640, 480);
  video = createCapture(VIDEO);
  video.size(width, height);

  canvas.parent("video_container");
  video.parent("video_container");

  result_table = document
    .getElementById("result_table")
    .getElementsByTagName("tbody")[0];

  // Setup postNet
  poseNet = ml5.poseNet(video, 
    // {
    //   architecture: "ResNet50",
    //   detectionType: "single",
    //   maxPoseDetections: 1,
    //   minConfidence: 0.5,
    //   outputStrides: 32,
    //   inputResolution: 257,
    //   multiplier: 1.0,
    //   quantBytes: 2,
    // },
    function () {
    console.log("Loaded: poseNet");
  });
  poseNet.on("pose", function (poses) {
    // If there is a poses
    if (poses.length > 0) {
      // Sort poses by score high to low
      poses = poses.sort(function (a, b) {
        let keyA = a.pose.score;
        let keyB = b.pose.score;
        if (keyA > keyB) return -1;
        if (keyA < keyB) return 1;
        return 0;
      });

      // select the pose with highest score
      pose = poses[0].pose;
      skeleton = poses[0].skeleton;
    }
  });

  // Load pose classification
  wisdom = ml5.neuralNetwork({
    input: 34,
    output: 3,
    task: "classification",
    dubug: true,
  });
  const modelInfoBed = {
    model: "bed_model/model.json",
    metadata: "bed_model/model_meta.json",
    weights: "bed_model/model.weights.bin",
  };

  wisdom.load(modelInfoBed, function () {
    console.log("Loaded: pose classification in bed");
    classifyPose();
  });

  // Setup detector
  detector = ml5.objectDetector("cocossd", function () {
    console.log("Loaded: detector - cocossd");
    detector.detect(video, detectObject);
  });

  video.hide();
}

function classifyPose() {
  if (pose) {
    let inputs = [];
    for (let i = 0; i < pose.keypoints.length; i++) {
      let x = pose.keypoints[i].position.x;
      let y = pose.keypoints[i].position.y;
      inputs.push(x);
      inputs.push(y);
    }

    // Input should contains 34 coordinates
    if (inputs.length == 34) {
      wisdom.classify(inputs, function (error, poseResults) {
        if (error) {
          console.log("Error", error);
        }

        if (!error && poseResults.length > 0) {
          // Update pose
          poseLabel = poseResults[0].label;
          if (poseLabel == 'g' && intersection){
            poseLabel = "Patient is sleeping on bed.";
          }else if (poseLabel == 's' && intersection){
            poseLabel = "Patient is sitting on bed.";
          }else if (poseLabel == 'u' && intersection){
            poseLabel = "Patient is getting up on bed.";
          }else if (poseLabel == 't' && intersection){
            poseLabel = "Patient is standing at bed.";
          }else if (poseLabel == 'w' && intersection){
            poseLabel = "Patient is walking.";
          }else if (poseLabel == 'f' && intersection){
            poseLabel = "Patient is falling down on floor.";
            swal({
              title: "Warning!",
              text: "Patient is falling down on floor",
              icon: "warning",
            });
          } else if (objectResults.label === "person"){
              window.clearTimeout(timer);
          } else {
                if(!timer){
                  timer = window.setTimeout(()=>{
                    console.log('warning');
                    timer = underfine;
                  }, 5000) //5 sec
                  swal({
                    title: "Notification",
                    text: "Patient is left.",
              });
            }
          }
          poseposeConfidence = poseResults[0].confidence;
        }
        console.log(poseResults)
      });
    }
  }

  // Recursive call - with timeout
  setTimeout(classifyPose, timeout_pose);
}

function detectObject(error, objectResults) {
  if (error) {
    console.log("Error", error);
  }

  if (!error && objectResults.length > 0) {
    detectedObjects = objectResults;
     detectedObjects.forEach(object => {
        detectedObjects = object.label;
        for (let i = 0; i < detectedObjects.length; i++){
          for(let j = 0; j < detectedObjects.length; j++){
            if (detectedObjects[i].label === "person"){
              intersection = detectedObjects[i].intersects(detectedObjects[j]);
              if(intersection){
                intersection = detectedObjects[j];
                return intersection;
              }
            }
          }
        }
     });
  }

  // Recursive call - with timeout
  setTimeout(() => {
    detector.detect(video, detectObject);
  }, timeout_detector);

  console.log(objectResults);
}

function draw() {
  image(video, 0, 0, width, height);

  //showPostNetResult();
  //showDetectedResult();

  showResultInHtml();
}

function showResultInHtml() {
  // Do clock check
  if (new Date().getTime() - clock < updateHTMLEveryMS) return;
  clock = new Date().getTime();

  // If poseLabel empty
  if (!poseLabel) return;

  // Insert at top row
  let newRow = result_table.insertRow(0);
  newRow.innerHTML =
    `<tr>
      <td>${new Date().toLocaleTimeString()}</td>
      <td>${poseLabel}</td>
    </tr>` + newRow.innerHTML;

  // If row length exceeds limit remove it - for performance purpose
  if (result_table.rows.length > limit_table_row) {
    result_table.deleteRow(limit_table_row);
  }
}

function showPostNetResult() {
  if (!pose || !skeleton) return;

  for (let j = 0; j < pose.keypoints.length; j++) {
    let keypoint = pose.keypoints[j];
    if (keypoint.score > 0.2) {
      fill(255, 0, 0);
      noStroke();
      ellipse(keypoint.position.x, keypoint.position.y, 10, 10);
    }
  }

  for (let j = 0; j < skeleton.length; j++) {
    let partA = skeleton[j][0];
    let partB = skeleton[j][1];
    stroke(255, 0, 0);
    line(
      partA.position.x,
      partA.position.y,
      partB.position.x,
      partB.position.y
    );
  }
}

function showDetectedResult() {
  if (!detectedObjects) return;

  detectedObjects.forEach((object) => {
    noStroke();
    fill(255, 0, 0);
    strokeWeight(3);
    textSize(30);
    text(object.label, object.x, object.y + 20);

    noFill();
    strokeWeight(3);

    if (object.label === "person") {
      stroke(0, 255, 0);
    } else {
      stroke(0, 0, 255);
    }

    rect(object.x, object.y, object.width, object.height);
  });
}
