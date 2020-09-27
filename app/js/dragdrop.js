var counter = 0;

$(function () {
    var $droptarget = $("#droptarget");
    $(document).on('dragenter', (e) => {
        counter++
        if (counter == 1) {
            $("#yturl").val("");
            console.log('showing target');
            $droptarget[0].style.display = "flex";
        }
        e.preventDefault();
        e.stopPropagation();
    });

    $(document).on('dragleave', (e) => {
        counter--;
        if (counter === 0) {
            $droptarget.hide();
            console.log('hiding target');
        }
        e.preventDefault();
        e.stopPropagation();
    });

    $(document).on('dragover', function (event) {
        event.preventDefault();
    })

    document.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        $droptarget.hide();
        counter = 0
        if (currentStep != "done" && currentStep != "") {
            console.log('Already converting something, not starting a 2nd conversion')
            return;
        }
        dropConvert = true;
        for (const f of event.dataTransfer.files) {
            youtubeFileLocation = f.path;
            console.log('File Path of dragged files: ', f.path)
        }
        if (youtubeFileLocation) {
            startClicked();
        }
    });

})