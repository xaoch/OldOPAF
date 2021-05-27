var pptPng = require("ppt-png");
var converter = new pptPng({
    files:    ["../recordings/xavierochoa_2019_6_15_9_50/Presentation/Session03.pptx"],
    output:   '../outputSlides/',
    outputType:    'png',
    invert:   false,
    callback: function(data) {
        console.log(data.failed, data.success, data.files, data.time);
    }
})
converter.run();
