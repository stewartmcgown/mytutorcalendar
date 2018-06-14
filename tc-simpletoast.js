/*
    by Stewart McGown @lordpankake 
      https://twistedcore.co.uk
*/
window.toasts = 0;

function toast(content,icon){
    window.toasts += 1;
    $("body").append(
        '<div class="toast" id="toast-'+toasts+'"></div>'
    );

    var toast = $("#toast-" + toasts);
    
    /* apply options */
    toast.html(content);

    if (icon)
        toast.prepend("<i class='fa fa-" + icon + "'></i>");

    //toast.append("<a href='#' data-dismiss='toast' class='toast-link'>Done</a>")

    toast.addClass("toast-opening");

    toast.css('bottom','20px');

    setTimeout(function(){
        window.toasts -= 1;
        toast.removeClass("toast-opening").addClass("toast-closing");
        setTimeout(function(){
            toast.remove();   
        },1000);

    },3000);
}

