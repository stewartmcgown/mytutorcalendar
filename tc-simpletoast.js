/* 
    by Stewart McGown @lordpankake 
      https://twistedcore.co.uk
*/
var toasts = 0;

function toast(content){
    toasts += 1;
    $("body").append(
        '<div class="toast" id="toast-'+toasts+'"></div>'
    );

    var toast = $("#toast-" + toasts);
    
    /* apply options */
    toast.html(content);

    toast.addClass("toast-opening");
    toast.css('bottom','20px');

    setTimeout(function(){
        toast.removeClass("toast-opening").addClass("toast-closing");
        setTimeout(function(){
            toast.remove();   
        },1000);

    },3000);
}

