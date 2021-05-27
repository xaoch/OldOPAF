const express = require('express');
const app = express();
const exec = require('child_process').exec;
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const pptPng = require("ppt-png");
var parse = require('csv-parse/lib/sync');
var AdmZip = require('adm-zip');

var scores;

app.set('view engine', 'ejs')
app.use(express.static('public'));
app.use('/recordings', express.static('../recordings'))
app.use(fileUpload());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  res.render('index');
})

app.get('/start_preview', function (req, res) {
  console.log("Preview")
  execute = exec("bash/start_preview.sh", function(err, stdout, stderr) {
  if (err) {
    console.log("Error",err)
  }
  console.log(stdout);
  console.log(stderr);
});
  res.send("Previewing");
})

app.get('/stop_preview', function (req, res) {
  console.log("Stop Preview")
  execute = exec("bash/stop_preview.sh", function(err, stdout, stderr) {
  if (err) {
    console.log("Error",err)
  }
  console.log(stdout);
});
  res.send("Not Previewing");
})

app.post('/recording', function (req, res) {
  var id = req.body.id;
  var user = id.match(/^([^@]*)@/)[1];
  var user = user.replace(/[^\w\s]/gi, '')
  var now = new Date();
  var dir_name = user + "_"+ now.getFullYear() + "_"+ now.getMonth() + "_" + now.getDate() + "_" + now.getHours()+"_"+now.getMinutes();
  var path = "/home/augmented/opaf/recordings/"+dir_name
  var presentation = (Object.keys(req.files).length > 0);
  try {
     if (!fs.existsSync(path)){
    fs.mkdirSync(path)
  }
} catch (err) {
  console.error(err)
}
  if (presentation) {
    var presFile = req.files.file;
    fs.mkdirSync(path+"/Presentation/");
    fs.mkdirSync(path+"/Presentation/slides/");
    presFile.mv(path+"/Presentation/presentation.pptx", function(err) {
      if (err)
        console.error(err);
  });
  var converter = new pptPng({
      files:    [path+"/Presentation/presentation.pptx"],
      output:   path+"/Presentation/slides/",
      outputType:    'png',
      invert:   false,
      callback: function(data) {
          console.log(data.failed, data.success, data.files, data.time);
      }
  })
  converter.run();
}
execute = exec("bash/start_recording.sh "+path, function(err, stdout, stderr) {
if (err) {
  console.log("Error",err)
}
console.log(stdout);
});
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file


  // Use the mv() method to place the file somewhere on your server

  res.render('recording', { dir_name: dir_name, id:id });
})

app.get('/stop_recording', function (req, res) {
  var dir_name = req.query.dir_name;
  var filePath = "/home/augmented/opaf/recordings/"+dir_name+"/stop.signal";
  fs.closeSync(fs.openSync(filePath, 'w'));
  res.send('Recording Stoped');
})

app.get('/check_report', function (req, res) {
  var dir_name = req.query.dir_name;
  video= "/home/augmented/opaf/recordings/"+dir_name+"/Video/result.csv";
  audio= "/home/augmented/opaf/recordings/"+dir_name+"/Audio/result.json";
  finished= fs.existsSync(video) && fs.existsSync(audio);
  if(finished){
    res.send("Finished");
  }
  else {
    res.send("Working");
  }
})

app.get('/view_report', function (req, res) {
  var dir_name = req.query.dir_name;
  var id = req.query.id;
  audioResultFile="/home/augmented/opaf/recordings/"+dir_name+"/Audio/result.json";
  videoResultFile="/home/augmented/opaf/recordings/"+dir_name+"/Video/result.csv";
  presResultFile="/home/augmented/opaf/recordings/"+dir_name+"/Presentation/result.csv";
  var audioJsonFile  = fs.readFileSync(audioResultFile);
  var audioData = JSON.parse(audioJsonFile);
  console.log(audioData);


  videoFile=fs.readFileSync(videoResultFile);
  videoData= parse(videoFile);
  console.log(videoData);

  presFile=fs.readFileSync(presResultFile);
  presData= parse(presFile);
  console.log(presData);

  function filter(sourceArray) {
    var filteredArray=[];
    for(i=1;i<sourceArray.length;i++){
      if (i-1>0 && i+1<sourceArray.length) {
        if(sourceArray[i]==sourceArray[i-1]){
          filteredArray.push(sourceArray[i]);
        }
        else{
          if(sourceArray[i]==sourceArray[i+1]){
             filteredArray.push(sourceArray[i]);
          }
          else{
            if(sourceArray[i-1]==sourceArray[i+1]){
              filteredArray.push(sourceArray[i-1]);
            }
            else {
              filteredArray.push(sourceArray[i]);
            }
          }
        }
      }
      else{
        if (i-1>0){
          if(sourceArray[i]==sourceArray[i-2]){
            filteredArray.push(sourceArray[i]);
          }
          else{
            if(sourceArray[i]==sourceArray[i-1]){
               filteredArray.push(sourceArray[i]);
            }
            else{
              if(sourceArray[i-2]==sourceArray[i-1]){
                filteredArray.push(sourceArray[i-1]);
              }
              else {
                filteredArray.push(sourceArray[i]);
              }
            }
          }
         }
         else{
           if(sourceArray[i]==sourceArray[i+1]){
             filteredArray.push(sourceArray[i]);
           }
           else{
             if(sourceArray[i]==sourceArray[i+2]){
                filteredArray.push(sourceArray[i]);
             }
             else{
               if(sourceArray[i+2]==sourceArray[i+1]){
                 filteredArray.push(sourceArray[i+1]);
               }
               else {
                 filteredArray.push(sourceArray[i]);
               }
             }
           }
         }
      }
    }
    return filteredArray;
  }

  function calculateSummary(data){
    aData=data.audioData
    vData=data.videoData
    pData=data.presData

    gazeArray=[];
    postureArray=[];
    for (i=1;i<vData.length;i++){
      gazeArray.push(vData[i][1]);
    }
    for (i=1;i<vData.length;i++){
      postureArray.push(vData[i][2]);
    }
    gazeArray=filter(gazeArray);
    postureArray=filter(postureArray);

    gazeScore=0;
    for (i=1;i<gazeArray.length;i++){
      var value=gazeArray[i];
      if (value==="Public"){
          gazeScore=gazeScore+1
      }
    }
    gazeScore=gazeScore/gazeArray.length
    gazeValue="Good"
    gazeStyle="style5"
    gazeRecommendation=""
    if(gazeScore<0.5){
      gazeValue="Regular"
      gazeStyle="style3"
      gazeRecommendation="<li><i><b>Make eye contact with the audience.</b></i> Your purpose is to communicate with your audience, and people listen more if they feel you are talking directly to them. As you speak, let your eyes settle on one person for several seconds before moving on to somebody else. You do not have to make eye contact with everybody, but make sure you connect with all areas of the audience equally.</li>"
    }
    if(gazeScore<0.2){
      gazeValue="Poor"
      gazeStyle="style1"
      gazeRecommendation="<li><i><b>Make eye contact with the audience.</b></i> Your purpose is to communicate with your audience, and people listen more if they feel you are talking directly to them. As you speak, let your eyes settle on one person for several seconds before moving on to somebody else. You do not have to make eye contact with everybody, but make sure you connect with all areas of the audience equally.</li> <li><i><b>Avoid reading from the screen.</b></i> First, if you are reading from the screen, you are not making eye contact with your audience. Second, if you put it on your slide, it is because you wanted them to read it, not you.</li>"
    }

    postureScore=0;
    for (i=1;i<postureArray.length;i++){
      var value=postureArray[i];
      if (value==="Correct"){
          postureScore=postureScore+1
      }
    }
    postureScore=postureScore/postureArray.length
    postureValue="Good"
    postureStyle="style5"
    postureRecommedation=""

    if(postureScore<0.5){
      postureValue="Regular";
      postureStyle="style3";
      postureRecommendation="<li><i><b>Open Posture</b></i> A speaker should not cross his hands or legs because the audience might perceive it as the unwillingness to communicate.  You should not present your back to the audience.</li> "
    }
    if(postureScore<0.2) {
      postureValue="Poor";
      postureStyle="style1"
      postureRecommendation="<li><i><b>Open Posture</b></i> A speaker should not cross his hands or legs because the audience might perceive it as the unwillingness to communicate. You should not present your back to the audience.</li> <i><b>Open Gestures</b></i> A speaker should use their hands to communicate with the audience.</li>"
    }

    volumeArray=aData.Volumes
    count=0
    goodVolumes=0
    for(i=0;i<volumeArray.length;i++){
      speechIntervals=volumeArray[i].speechIntervals;
      soundIntensity=volumeArray[i].soundIntensity;
      meanSpeechIntensity=volumeArray[i].meanSpeechIntensity;
      if(speechIntervals>75){
        count=count+1
        if(meanSpeechIntensity>-38){
           goodVolumes=goodVolumes+1
        }
      }
    }
    volumeScore=goodVolumes/count
    volumeValue="Good"
    volumeStyle="style5"
    volumeRecommendation=""
    if(volumeScore<0.5){
      volumeValue="Regular"
      volumeStyle="style3"
      volumeRecommendation="<li><i><b>Increase the volume of your voice.</b></i> Your first goal is to be comfortably heard by everyone in the audience. If they cannot hear your voice, then you cannot deliver a message to them."
    }
    if(volumeScore<0.2){
      volumeValue="Poor"
      volumeStyle="style1"
      volumeRecommendation="<li><i><b>Increase the volume of your voice.</b></i> Your first goal is to be comfortably heard by everyone in the audience. If they cannot hear your voice, then you cannot deliver a message to them. <li><i><b>Start loud.</b></i> It’s not a strict rule, but generally a good idea to open a notch louder than average. It grabs attention and demonstrates enthusiasm.</li> <li><i><b>Finish loud.</b></i> Also not a rule, but speaking louder helps create a rousing, confident finish. This is especially true in a persuasive or motivational speech.</li>"
    }

    articulationArray=aData.SpeechRate
    count=0
    goodRates=0
    for(i=0;i<articulationArray.length;i++){
      articulationRate=articulationArray[i].articulationRate;
      rate=articulationArray[i].rate;
      count=count+1
      if(rate=="Normal"){
        goodRates=goodRates+1
      };
      if (!(rate=="Slow" || rate=="Normal" || rate=="Fast")){
        count=count-1
      }
    }
    articulationScore=0
    if(count>0)
    {
      articulationScore=goodRates/count
    }
    articulationValue="Good"
    articulationStyle="style5"
    articulationRecommendation=""
    if(articulationScore<0.5){
      articulationValue="Regular"
      articulationStyle="style3"
      articulationRecommendation="<li><i><b>Don’t speak as fast as you do in conversation.</b></i> You might speak as many as 400 words a minute in a lively conversation, but your audience needs you to slow down to 140-160 words a minute. It takes work to develop a slower presenting style, but you’ll be a more effective speaker.</li>"
    }
    if(articulationScore<0.2){
      articulationValue="Poor"
      articulationStyle="style1"
      articulationRecommendation="<li><i><b>Don’t speak as fast as you do in conversation.</b></i> You might speak as many as 400 words a minute in a lively conversation, but your audience needs you to slow down to 140-160 words a minute. It takes work to develop a slower presenting style, but you’ll be a more effective speaker.</li>"
    }

    fpArray=aData.FilledPauses
    count=0
    for(i=0;i<fpArray.length;i++){
      count=count+1
    }
    totalTime=vData.length
    totalTime=totalTime/2/60
    fpScore=count/totalTime
    fpValue="Good"
    fpStyle="style5"
    fpRecommendation=""
    if(fpScore>3){
      fpValue="Regular"
      fpStyle="style3"
      fpRecommendation="<li><i><b>Avoid filler words.</b></i> Um, like, you know, and many others. To an audience, these are indications that you do not know what to say; you sound uncomfortable, so they start to feel uncomfortable as well. Speak slowly enough that you can collect your thoughts before moving ahead. If you really do not know what to say, pause silently until you do.</li>"
    }
    if(fpScore>6){
      fpValue="Poor"
      fpStyle="style1"
      fpRecommendation="<li><i><b>Avoid filler words.</b></i> Um, like, you know, and many others. To an audience, these are indications that you do not know what to say; you sound uncomfortable, so they start to feel uncomfortable as well. Speak slowly enough that you can collect your thoughts before moving ahead. If you really do not know what to say, pause silently until you do.</li>"
    }


    slideNumber=pData.length;
    good=0;
    for(i=0;i<pData.length;i++){
      content=pData[i][1];
      if(content.localeCompare("None")==0)
      {
        good=good+1
      }
    }
    slidesScore=good/slideNumber;
    slidesValue="Good"
    slidesStyle="style5"
    slidesRecommendation=""
    if(slidesScore<0.5){
      slidesValue="Regular"
      slidesStyle="style3"
      slidesRecommendation="<li><i><b>Use a large font.</b></i> As a general rule, avoid text smaller than 18 point.</li>"
    }
    if(slidesScore<0.2){
      slidesValue="Poor"
      slidesStyle="style1"
      slidesRecommendation="<li><i><b>Use a large font.</b></i> As a general rule, avoid text smaller than 18 point.</li><li><i><b>Avoid long texts.</b></i>Put no more than 8 lines of text on any slide.</li>"
    }

    var summary ={
      gazeScore: gazeScore,
      gazeValue: gazeValue,
      gazeStyle: gazeStyle,
      gazeRecommendation: gazeRecommendation,
      postureScore: postureScore,
      postureValue: postureValue,
      postureStyle: postureStyle,
      postureRecommedation: postureRecommedation,
      volumeScore: volumeScore,
      volumeValue: volumeValue,
      volumeStyle: volumeStyle,
      volumeRecommendation: volumeRecommendation,
      articulationScore: articulationScore,
      articulationValue: articulationValue,
      articulationStyle: articulationStyle,
      articulationRecommendation: articulationRecommendation,
      fpScore: fpScore,
      fpValue: fpValue,
      fpStyle: fpStyle,
      fpRecommendation: fpRecommendation,
      slidesScore: slidesScore,
      slidesValue: slidesValue,
      slidesStyle: slidesStyle,
      slidesRecommendation: slidesRecommendation
    }
    return summary;
  }


  var data = {
    audioData: audioData,
    videoData: videoData,
    presData: presData,
  };

  summary=calculateSummary(data);


  var data = {
    audioData: audioData,
    videoData: videoData,
    presData: presData,
    summary: summary
  };

  data_sum = JSON.stringify(data);
  console.log(data_sum)
  fs.writeFile("../recordings/"+dir_name+"/summary.json", data_sum, function(err) {
  if (err) {
      console.log(err);
  }
  });

  //res.render("report",{data: data})
  res.render("report",{dir_name:dir_name, id:id, data:data});
})

app.get('/report_data_overview', function (req, res) {
    function filter(sourceArray) {
      var filteredArray=[];
      for(i=1;i<sourceArray.length;i++){
        if (i-1>0 && i+1<sourceArray.length) {
          if(sourceArray[i]==sourceArray[i-1]){
            filteredArray.push(sourceArray[i]);
          }
          else{
            if(sourceArray[i]==sourceArray[i+1]){
               filteredArray.push(sourceArray[i]);
            }
            else{
              if(sourceArray[i-1]==sourceArray[i+1]){
                filteredArray.push(sourceArray[i-1]);
              }
              else {
                filteredArray.push(sourceArray[i]);
              }
            }
          }
        }
        else{
          if (i-1>0){
            if(sourceArray[i]==sourceArray[i-2]){
              filteredArray.push(sourceArray[i]);
            }
            else{
              if(sourceArray[i]==sourceArray[i-1]){
                 filteredArray.push(sourceArray[i]);
              }
              else{
                if(sourceArray[i-2]==sourceArray[i-1]){
                  filteredArray.push(sourceArray[i-1]);
                }
                else {
                  filteredArray.push(sourceArray[i]);
                }
              }
            }
           }
           else{
             if(sourceArray[i]==sourceArray[i+1]){
               filteredArray.push(sourceArray[i]);
             }
             else{
               if(sourceArray[i]==sourceArray[i+2]){
                  filteredArray.push(sourceArray[i]);
               }
               else{
                 if(sourceArray[i+2]==sourceArray[i+1]){
                   filteredArray.push(sourceArray[i+1]);
                 }
                 else {
                   filteredArray.push(sourceArray[i]);
                 }
               }
             }
           }
        }
      }
      return filteredArray;
    }

    function detectRateSegments(valueSegments,sourceArray,group,counter){
      var segmentCounter=counter;
      for(i=0;i<sourceArray.length;i++){
        filename=sourceArray[i].filepath;
        articulationRate=sourceArray[i].articulationRate;
        rate=sourceArray[i].rate;
        start=(i*5*2)-10;
        stop=((i*5+5)*2)-10;
        if(rate=="Slow"){
          classname="incorrect";
          subgroup="sg_inc";
          content="Slow";
        };
        if(rate=="Normal"){
          classname="correct";
          subgroup="sg_cor";
          content="Normal";
        };
        if(rate=="Fast"){
          classname="incorrect";
          subgroup="sg_inc";
          content="Fast";
        };
        if (!(rate=="Slow" || rate=="Normal" || rate=="Fast")){
          classname="silence";
          subgroup="sg_inc";
          content="No Speech";
        }
        valueSegment={content:content, multimedia:"sound",group: group, start:start, end:stop, subgroup:subgroup,className:classname,soundfile:filename};
        valueSegments.push(valueSegment);
      }
      return valueSegments;
    }

    function detectVolumeSegments(valueSegments,sourceArray,group,counter){
      var segmentCounter=counter;
      for(i=0;i<sourceArray.length;i++){
        filename=sourceArray[i].filepath;
        speechIntervals=sourceArray[i].speechIntervals;
        soundIntensity=sourceArray[i].soundIntensity;
        meanSpeechIntensity=sourceArray[i].meanSpeechIntensity;
        start=(i*5*2)-10;
        stop=((i*5+5)*2)-10;
        classname="silence";
        subgroup="sg_inc";
        content="Mostly Silence";
        if(speechIntervals>75){
          classname="v_low";
          subgroup="sg_inc";
          content="Low";
          if(meanSpeechIntensity>-42){
             classname="v_medium";
             subgroup="sg_inc";
             content="Medium";
          }
          if(meanSpeechIntensity>-38){
             classname="v_high";
             subgroup="sg_cor";
             content="High";
          }
        }
        valueSegment={content:content, multimedia:"sound",group: group, start:start, end:stop, subgroup:subgroup,className:classname,soundfile:filename};
        valueSegments.push(valueSegment);
      }
      return valueSegments;
    }

    function detectFPSegments(valueSegments,sourceArray,group,counter){
      var segmentCounter=counter;
      for(i=0;i<sourceArray.length;i++){
        filename=sourceArray[i].path;
        filename=filename.substring(filename.lastIndexOf('/')+1)
        audioPos=filename.substring(filename.lastIndexOf('-')+1,filename.lastIndexOf('_'))
        start=sourceArray[i].start;
        start=(((audioPos-1)*5+(start/1000))*2)-10;
        classname="fp";
        subgroup="sg_inc";
        content="Filled Pause";
        valueSegment={content:content, multimedia:"fp",group: group, start:start, subgroup:subgroup,className:classname,soundfile:filename};
        valueSegments.push(valueSegment);
      }
      return valueSegments;
    }

    function detectSlideSegments(valueSegments,sourceArray,group,total){
      //var segmentCounter=counter;
      slideDuration=total/sourceArray.length
      for(i=0;i<sourceArray.length;i++){
        filename=sourceArray[i][0];
        content=sourceArray[i][1];
        start=slideDuration*i;
        stop=(slideDuration)*(i+1);
        classname="incorrect";
        subgroup="sg_inc";
        console.log(content)
        if(content.localeCompare("None")==0)
        {
          classname="correct";
          subgroup="sg_cor";
          content="Ok"
        }
        image="recordings/"+dir_name+"/Presentation/slides/1_page_"+(i+1)+".png";
        content=content+"<br/><img class='fancybox' src='"+image+"' width='80px' height='64px'/>"
        valueSegment={content:content, multimedia:"image", group: group, start:start, end:stop, subgroup:subgroup,className:classname, image_source:image};
        valueSegments.push(valueSegment);
      }
      return valueSegments;
    }

    function detectSegments(valueSegments,sourceArray,group,counter){
      var segmentCounter=counter;
      var currentValue="NONE";
      var start=0;
      var stop=0;
      for(i=0;i<sourceArray.length;i++){
        var value=sourceArray[i];
        if(currentValue==value && i<(sourceArray.length-1)){
          stop=i;
        }
        else{
          segmentCounter=segmentCounter+1;
          classname="incorrect";
          subgroup="sg_inc";
          if (currentValue==="Correct" || currentValue==="Public"){
            classname="correct";
            subgroup="sg_cor";
          }
          content=currentValue;
          var j;
          var image="None";
          for(j=start;j<stop+1;j++)
          {
            framePath="/home/augmented/opaf/recordings/"+dir_name+"/Video/"+currentValue+"/img_"+j+".jpg";
            if (fs.existsSync(framePath)){
              image="recordings/"+dir_name+"/Video/"+currentValue+"/img_"+j+".jpg";
              break;
            }
          }
          if(!(image==="None")){
            content=content+"<br/><img class='fancybox' src='"+image+"' width='80px' height='64px'/>"
            valueSegment={content:content, multimedia:"image", group: group, start:start, end:stop, subgroup:subgroup,className:classname,image_source:image};
          }
          else{
          valueSegment={content:content, multimedia:"none", group: group, start:start, end:stop, subgroup:subgroup,className:classname};
          }
          if(currentValue!="NONE"){
            valueSegments.push(valueSegment);
          }
          start=i;
          stop=i;
          currentValue=value;
        }
      }
      return valueSegments;
    }

    var dir_name = req.query.dir_name;
    //var reportDir="/home/augmented/opaf/Control/public/reports/"+dir_name+"/"
    //if (!fs.existsSync(reportDir)){
    //   fs.mkdirSync(reportDir);
    //}
    videoResultFile="/home/augmented/opaf/recordings/"+dir_name+"/Video/result.csv";
    videoFile=fs.readFileSync(videoResultFile);
    videoData= parse(videoFile);
    var i;
    console.log(videoData.length);
    gazeArray=[];
    postureArray=[];
    for (i=1;i<videoData.length;i++){
      gazeArray.push(videoData[i][1]);
    }
    for (i=1;i<videoData.length;i++){
      postureArray.push(videoData[i][2]);
    }
    gazeArray=filter(gazeArray);
    postureArray=filter(postureArray);

    segments=[];
    segments=detectSegments(segments,gazeArray,0);
    segments=detectSegments(segments,postureArray,1);

    //var reportDir="/home/augmented/opaf/Control/public/reports/"+dir_name+"/"
    //if (!fs.existsSync(reportDir)){
    //   fs.mkdirSync(reportDir);
    //}
    audioResultFile="/home/augmented/opaf/recordings/"+dir_name+"/Audio/result.json";
    var audioJsonFile  = fs.readFileSync(audioResultFile);
    var audioData = JSON.parse(audioJsonFile);

    segments=detectVolumeSegments(segments,audioData.Volumes,2);
    segments=detectRateSegments(segments,audioData.SpeechRate,3);
    segments=detectFPSegments(segments,audioData.FilledPauses,5);


    presResultFile="/home/augmented/opaf/recordings/"+dir_name+"/Presentation/result.csv";
    presFile=fs.readFileSync(presResultFile);
    presData= parse(presFile);

    segments=detectSlideSegments(segments,presData,4,videoData.length);



    var data=segments;
    data_str = JSON.stringify(data);
    fs.writeFile("../recordings/"+dir_name+"/report_data_overview.json", data_str, function(err) {
    if (err) {
        console.log(err);
    }
    });

    res.send(data);
})

app.get('/get_zip_report', function (req, res) {
  var dir_name = req.query.dir_name;
  var id = req.query.id;
  var content = fs.readFileSync("../recordings/"+dir_name+"/summary.json");
  var jsonContent = JSON.parse(content);

  var vis_content = fs.readFileSync("../recordings/"+dir_name+"/report_data_overview.json");
  var vis_jsonContent = JSON.parse(vis_content);

  var createZipArchive=function(name, files, cb){
        // create our zip...
        var zip=new AdmZip();
        // add the files to the zip
        if(Array.isArray(files)){
          files.forEach(function(file){
            if(file.mode=="online")
              {
                zip.addFile(file.name,new Buffer(file.content));
              }
            if(file.mode=="dir")
                {
                  zip.addLocalFolder(file.filename,file.path);
                }
            if(file.mode=="disk"){
                zip.addLocalFile(file.filename,file.path);
              }
            })
          };

        // pass the filename and the new zip to the callback
        return cb(name, zip);
  };

  var sendResult=function(name, zip){
       res.contentType('application/zip');
       res.setHeader('content-disposition','attachment; filename=' + name);
       return res.send(zip.toBuffer());
  };

  data=jsonContent
  vis_data=JSON.stringify(vis_jsonContent)
  date=dir_name.substring(dir_name.indexOf('_')+1);
  var parts =date.split('_');
  var mydate = parts[0]+"/"+(parseInt(parts[1])+1).toString()+"/"+parts[2]+" "+parts[3]+":"+parts[4];
  console.log("The Data")
  console.log(parts);
  app.render('report_zip', {dir_name:dir_name, id:id, date:mydate,data:data,vis_data:vis_data}, function(err,html){
       if(err){
         return res.status(500).send('failed to render view: '+err);
       }
       var filename='report.zip',
                files=[
                  {
                    name:"../recordings/"+dir_name,
                    mode:'dir',
                    filename: "../recordings/"+dir_name,
                    path: 'recordings/'+dir_name
                  },
                  {
                    name:"public/assets",
                    mode:'dir',
                    filename: "public/assets",
                    path: 'assets'
                  }
                  ,{
                    name:"public/images",
                    mode:'dir',
                    filename: "public/images",
                    path: 'images'
                  }
                  ,
                  {
                    name:'report.html',
                    mode:'online',
                    content:html,
                    path: ''
                  }
                ];


          return createZipArchive(filename,files,sendResult);
   });

});

app.listen(80, function () {
  console.log('Example app listening on port 80!')
})
