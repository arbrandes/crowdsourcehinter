function CrowdsourceHinter(runtime, element){
    //use executionFunctions to prevent old initializations of hinter from working after switching units
    var executeFunctions = true;
    if(executeFunctions){
    var isShowingHintFeedback = false;
    var isStaff = false;
    $(".HintsToUse", element).text("");

    function stopScript(){
    //This function is used to prevent a particular instance of the hinter from acting after
    //switching between edX course's units. 
        executionFunctions = false;
    }
    Logger.listen('seq_next', null, stopScript);
    Logger.listen('seq_prev', null, stopScript);
    Logger.listen('seq_goto', null, stopScript);

    //read the data from the problem_graded event here
    function get_event_data(event_type, data, element){
        console.log("is this still changing");
        onStudentSubmission(data);
    }
    Logger.listen('problem_graded', null, get_event_data);

    function onStudentSubmission(problem_graded_event_data){
    //This function will determine whether or not the student correctly answered the question.
    //If it was correctly answered it will begin the process for giving feedback on hints.
        if (problem_graded_event_data[1].search(/class="correct/) === -1){
            $.ajax({
                type: "POST",
                url: runtime.handlerUrl(element, 'get_hint'),
                data: JSON.stringify({"submittedanswer": unescape(problem_graded_event_data[0])}),
                success: seehint
            });
        }else{
            $('.csh_correct', element).show();
            $('.csh_correct', element).text("You're correct! Please help us improve our hints by voting on them, or submit your own hint!");
            $(".csh_HintsToUse", element).text(" ");
            //send empty data for ajax call because not having a data field causes error
            $.ajax({
                type: "POST",
                url: runtime.handlerUrl(element, 'is_user_staff'),
                data: JSON.stringify({}),
                success: function(result) {
                    if (result['is_user_staff']) {
                        isStaff = true;
                        $('.crowdsourcehinter_block').attr('csh_isStaff', true);
                        $.ajax({
                            type: "POST",
                            url: runtime.handlerUrl(element, 'get_feedback'),
                            data: JSON.stringify({"isStaff":"true"}),
                            success: getFeedback
                        });
                    } else {
                        $.ajax({
                            type: "POST",
                            url: runtime.handlerUrl(element, 'get_feedback'),
                            data: JSON.stringify({"isStaff":"false"}),
                            success: getFeedback
                        });
                    }
                }
            });
        }  
    }

    function seehint(result){
    //Show a hint to the student after an incorrect answer is submitted.
        $('.csh_HintsToUse', element).text(result.HintsToUse);
    }

    function showHintFeedback(result){
    //Append answer-specific hints for each student answer during the feedback stage.
    //This appended div includes upvote/downvote/flagging buttons, the hint, and the hint's rating
        $(".csh_student_answer", element).each(function(){
            if ($(this).find("span").text() == result.student_answer){
                /*var template = $('#show_hint_feedback').html();
                var data = {
                    hint: result.hint,
                    rating: result.rating
                };
                $(this).append(Mustache.render(template, data));*/
                $(this).append(unescape("<div class=\"csh_hint_value\" value = \"" + result.hint + "\">" +
                "<div role=\"button\"class=\"csh_rate_hint\"data-rate=\"upvote\" data-icon=\"arrow-u\" aria-label=\"upvote\"><b>↑</b></div>" +
                "<div role=\"button\" class=\"csh_rate_hint\" data-rate=\"flag\" data-icon=\"flag\" aria-label=\"flag\"><b>!</b></div>"+
                "<div class = \"csh_rating\">" + result.rating + "</div>"+
                "<div class=\"csh_hint\">" + ""+result.hint+"</div>" +
                "<div role=\"button\" class=\"csh_rate_hint\" data-rate=\"downvote\" aria-label=\"downvote\"><b>↓</b></div> </div>"));
            }
        });
    }

    function showFlaggedFeedback(result){
    //For staff use, shows hints that have been flagged by students and allows for the hints' unflagging/removal.
        $(".csh_flagged_hints", element).append(unescape("<div class=\"csh_hint_value\" value = \"" + result.hint + "\">" +
                "<div role=\"button\" class=\"csh_staff_rate\" data-rate=\"unflag\" aria-label=\"unflag\"><b>O</b></div>" +
                "<hint class=\"csh_hint\">" + ""+result.hint+"</hint>" +
                "<div role=\"button\" class=\"csh_staff_rate\" data-rate=\"remove\" aria-label=\"remove\"><b>X</b></div> </div>"));
        /*var template = $('#show_flagged_feedback').html();
        var data = {
            hint: result.hint
        };
        $(".flagged_hints", element).append(Mustache.render(template, data));*/
    }

    function setStudentAnswers(student_answers){
    //Append divs for each answer the student submitted before correctly answering the question.
    //showHintFeedback appends new hints into these divs.
        for(var i = 0; i < student_answers.length; i++){
            $('.csh_feedback', element).append("<div class=\"csh_student_answer\"><span><b>"+student_answers[i]+"</b></span>"+
            "<div><input type =\"button\" class=\"csh_student_hint_creation\"value=\"Submit a new hint for this answer.\" </input></div></div>");
            /*
            var template = $('#show_answer_feedback').html();
            var data = {
                answer = student_answers[i]
            };
            $(".feedback", element).append(Mustache.render(template, data));
            */
        }
    }

    function getFeedback(result){
    //Set up the student feedback stage. Each student answer and all answer-specific hints for that answer are shown
    //to the student, as well as an option to create a new hint for an answer.
        if(!isShowingHintFeedback){
            var student_answers = [];
            $.each(result, function(index, value) {
                answer = value;
                if($.inArray(answer, student_answers) === -1 && answer != "Flagged"){
                    student_answers.push(answer);
                }
            });
            setStudentAnswers(student_answers);
            $.each(result, function(index, value) {
                student_answer = value;
                hint = index;
                //hints return null if no answer-specific hints exist
                if(hint === "null"){
                    $(".csh_student_answer", element).each(function(){
                        if ($(this).find("span").text() == student_answer){
                            $(this).append("<div class=\"csh_hint_value\" value=\"There are no answer-specific hints for this answer.\"></div>");
                        }
                    });
                }
                //flagged hints have their corresponding answer set to "Flagged"
                else if(student_answer != "Flagged"){
                    $.ajax({
                        type: "POST",
                        url: runtime.handlerUrl(element, 'get_ratings'),
                        data: JSON.stringify({"student_answer": student_answer, "hint": hint}),
                        success: showHintFeedback
                    });
                }
                else{
                    $.ajax({
                        type: "POST",
                        url: runtime.handlerUrl(element, 'get_ratings'),
                        data: JSON.stringify({"student_answer": student_answer, "hint": hint}),
                        success: showFlaggedFeedback
                    });
                }
            });
            isShowingHintFeedback = true;
        }
    }
    
    $(element).on('click', '.csh_student_hint_creation', function(){
    //Click event for the creation of a new hint. This button will bring up the text input.
        $('.csh_student_hint_creation').each(function(){
            $(this).show();
        });
        $('.csh_student_text_input').remove();
        $('.csh_submit_new').remove();
        $(this).hide();
        student_answer = $(this).parent().parent().find("span").text();
        $(".csh_student_answer", element).each(function(){
            if ($(this).find("span").text() == student_answer){
                $(this).append("<p><input type=\"text\" name=\"studentinput\" class=\"csh_student_text_input\" size=\"40\"><input answer=\""+student_answer+"\" type=\"button\" class=\"csh_submit_new\" value=\"Submit Hint\"> </p>");
            }
        });
    })

    $(element).on('click', '.csh_submit_new', function(){
    //Click event to submit a new hint for an answer. 
        if($(this).parent().find('.csh_student_text_input').val() != null){
            var answerdata = unescape($(this).attr('answer'));
            var newhint = unescape($('.csh_student_text_input').val());
            Logger.log('submit_new.click.event', {"student_answer": answerdata, "new_hint_submission": newhint});
            $('.csh_submitbutton').show();
            $.ajax({
                type: "POST",
                url: runtime.handlerUrl(element, 'give_hint'),
                data: JSON.stringify({"submission": newhint, "answer": answerdata}),
                success: function(result){
                        $.ajax({
                            type: "POST",
                            url: runtime.handlerUrl(element, 'get_ratings'),
                            data: JSON.stringify({"student_answer": answerdata, "hint": newhint}),
                            success: showHintFeedback
                        });
                    }
            });
            $(this).parent().find('.csh_student_text_input').remove();
            $(this).remove();
        }
    })

    $(element).on('click', '.csh_rate_hint', function(){
    //Click event to change the rating/flag a hint. The attribute 'data-rate' within each .rate_hint button is used
    //to determine whether the student is upvoting, downvoting, or flagging the hint. 
        hint = $(this).parent().find(".csh_hint").text();
        student_answer = $(this).parent().parent().find("span").text();
        Logger.log('crowd_hinter.rate_hint.click.event', {"hint": hint, "student_answer": student_answer, "rating": $(this).attr('data-rate')});
        $.ajax({
            type: "POST",
            url: runtime.handlerUrl(element, 'rate_hint'),
            data: JSON.stringify({"student_rating": $(this).attr('data-rate'), "hint": hint, "student_answer": student_answer}),
            success: function (result){
                    if(result.rating == "flagged"){
                        $(this).parent().hide();
                        $(this).parent().remove();
                    }
                    else if(result.rating != "voted"){
                        $(".csh_hint", element).each(function(){
                            if ($(this).parent().find(".csh_hint").text() == hint && $(this).parent().parent().find("span").text() == student_answer){
                                $(this).parent().find('.csh_rating').text(result.rating);
                            }
                    })
                }
            }
        });
    })

    $(element).on('click', '.csh_staff_rate', function(){
    //Staff ratings are the removal or unflagging of flagged hints from the database. The attribute 'data-rate' is used
    //to determine whether to unflag or delete the hint.
        hint = $(this).parent().find(".csh_hint").text();
        student_answer = $(this).parent().parent().find("span").text();
        $.ajax({
            type: "POST",
            url: runtime.handlerUrl(element, 'rate_hint'),
            data: JSON.stringify({"student_rating": $(this).attr('data-rate'), "hint": hint, "student_answer": student_answer}),
            success: function (result){
                    $('.csh_hint_value', element).each(function(){
                        if($(this).attr('value') == hint){
                            $(this).remove();
                        }
                    });
            }
        });
    })
}}
