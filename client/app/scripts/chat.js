/**
 * Created by user on 2014/8/30.
 */

$(document).ready(function () {
    if (typeof console == "undefined") {

        console = {
            log: function () {
            },
            error: function () {
            }
        };
    }
    if (!$.support.leadingWhitespace) {
//IE6\7\8
        var d = $("#divcontent");
        d.removeClass("divcontent");
        d.addClass("divcontent_ie8");
        d = $("#divLeaveMessage");
        d.removeClass("divLeaveMessage");
        d.addClass("divLeaveMessage_ie8");
    } else if ($.support.optSelected && $.support.transition.end == "transitionend") {
        //火狐
        $("#div_face").css("top", "15px");
        $("#div_upload_img").css("top", "15px");

    }
    messages = [];
    var socket = null;
    var divchat = $("#divcontent")[0];
    var send_msg_box = $('#msgTxt');
    var emoji_pic_path = 'emoji/qqemoji/';

    $('.emotion').qqFace({
        id: 'facebox',
        assign: 'msgTxt',
        path: emoji_pic_path	//表情存放的路径
    });

    $("body").keydown(function (event) {
        if (event.ctrlKey && event.keyCode == '13') {
            sendmsg();

        }
    });
    //获取url参数
    function getQueryString(name) {
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
        var r = window.location.search.substr(1).match(reg);
        if (r != null) return unescape(r[2]);
        return null;
    }

    //显示logo函数
    function display_logo(logo) {
        var display = getQueryString("logo");
        if (display == "0") {
            $("#div_border")[0].style.width = "600px";
            $("#div_logo")[0].style.display = "none";
        }
        else {
            if (logo != "" && logo != null) {
                var logo_arr = logo.split("../..");
                if (logo_arr.length > 1) {
                    logo = logo_arr[1];
                    $("#div_border")[0].style.width = "821px";
                    $("#div_logo")[0].style.display = "";
                    $("#img_logo")[0].src = logo;
                }
            }
        }
    }
    var printMsg=true;
    //显示工作时间函数
    function display_work_style(work_begintime_str, work_endtime_str) {
        var nTime = new Date();
        var nDay=nTime.getFullYear()+"-"+(parseInt(nTime.getMonth())+1)+"-"+nTime.getDate()+" ";
        var work_begintime =new Date(nDay + work_begintime_str);
        var work_endtime = new Date(nDay + work_endtime_str);


        if(work_begintime>nTime||nTime>work_endtime){
            displayMsg("left", "亲，现在是人工客服非上班时间，请在留言页面提交您的问题或建议");
            $("#b_sendMsg")[0].disabled=true;
            printMsg=false;
        }
    }

    function authed() {
        var appname = getQueryString("appname")

        if (appname == null||appname=="") {
            appname="webchat";

        }

        var result;
        result = $.ajax({
            url: "../authed?accname=" + appname,
            type: "get",
            cache: false,
            dataType: "json",
            contentType: 'application/json; charset=UTF-8',
            timeout: 60000,
            success: function (data, status, xhr) {
                if (data.authed) {
                    $("#d_captcha")[0].style.display = "none";

                    display_logo(data.logo);
                    display_work_style(data.work_begintime, data.work_endtime);
                    if(printMsg){
                        init_sockio();
                    }

                    tip("请输入您要咨询的问题，按ctrl+enter发送");
                } else {
                    $("#d_captcha")[0].style.display = "";
                    if (data.desc) {
                        tip(data.desc);
                    } else {
                        tip("请通过验证后再输入您要咨询的内容，按ctrl+enter发送");
                    }
                    $("#t_captcha")[0].focus();
                }
            },
            error: function (xhr, status, ex) {
                console.log(ex);

            }
        });
    }

    authed();
    $("#form_captcha").submit(function (event) {
        var result;
        result = $.ajax({
            url: "../captcha",
            type: "POST",
            cache: false,
            dataType: "json",
            data: JSON.stringify({captcha: $("#t_captcha")[0].value}),
            contentType: 'application/json; charset=UTF-8',
            timeout: 60000,
            success: function (data, status, xhr) {
                if (data.result) {
                    $("#d_captcha")[0].style.display = "none";
                    init_sockio();
                    tip("验证成功,请输入您要咨询的问题，按ctrl+enter发送");
                } else {
                    tip("验证码错误，请重新输入");
                    $("#t_captcha")[0].focus();
                    $("#t_captcha")[0].select();
                }
            },
            error: function (xhr, status, ex) {
                console.log(ex);

            }
        });
//    event.preventDefault();
        return false;
    });

    function init_sockio() {
        // var socket_url=window.location.origin+"/webchat/socket.io";
        //socket = io.connect(socket_url);
        socket = io();

        /**
         接收消息
         */
        socket.on('ImMessage', function (data) {
            console.log(data);
            var content = parse_content(data.Content);
            console.log(content);
            content = reg_br(content);
            content = reg_email(content);
            displayMsg("left", content);
        });
        socket.on('connect', function () {
            reqRG();
        });

    }

    ractive = new Ractive({
        el: 'messages_output',
        template: '#messages_template',
        data: { messages: messages }
    });
    function tip(msg) {
        send_msg_box.val('');
        send_msg_box[0].placeholder = msg;
        send_msg_box[0].focus();
    }

/// 发送消息
    $('#msgFrm').submit(function (event) {
        sendmsg();
        //    event.preventDefault();
        return false;
    });
    var sendmsg = function () {
        if (!socket) {
            tip("请验证通过后再咨询");
            $("#t_captcha")[0].focus();
            return false;
        }
        var msg = send_msg_box.val();
        send_msg_box.val('');
        msg = msg.trim();
        if (msg == "") {
            tip("不能发送空消息");

            return false;
        }

        var dt = new Date();
        displayMsg("right", reg_email(reg_http(parse_content(reg_br(msg)))));
        var data = {
            FromUserName: '客户',
            MsgType: 'text',
            Content: msg
        };

        var result;
        result = $.ajax({
            url: "../sendmsg",
            type: "POST",
            cache: false,
            dataType: "json",
            data: JSON.stringify(data),
            contentType: 'application/json; charset=UTF-8',
            timeout: 60000,
            success: function (data, status, xhr) {
                if (data) {
                    if (data.desc) {
                        displayMsg("left", data.desc);
                    }
                }
            },
            error: function (xhr, status, ex) {
                console.log(ex);

            }
        });
        divchat.scrollTop = divchat.scrollHeight;
        tip("请输入您要咨询的问题，按ctrl+enter发送");

//        socket.emit('ImMessage', data);

    };

//    function replace_em(str) {
//        str = str.replace(/\</g, '&lt;');
//        str = str.replace(/\>/g, '&gt;');
//        str = str.replace(/\n/g, '<br/>');
//        str = str.replace(/\[em_([0-9]*)\]/g, '<img src="./' + emoji_pic_path + '$1.png" border="0" />');
//        return str;
//    }
    function reg_br(content) {
        var regRN = /\r\n/g;
        content = content.replace(regRN, "<br />");
        var regR = /\r/g;
        var regN = /\n/g;
        content = content.replace(regR, "<br />").replace(regN, "<br />");
        return content;
    }

    function reg_email(str) {
        str = str.replace(/\b(\w+@[\w+\.?]*)/gi,
            "<a href=\"mailto\:$1\" target='_blank '>$1</a>");
        return str;
    }

    function reg_http(str) {

        str = str.replace(/\bhttp\:\/\/www(\.[\w+\.\:\/\_]+)/gi,
            "http\:\/\/&not;¤&cedil;$1");
        str = str.replace(/\b(http\:\/\/\w+\.[\w+\.\:\/\_]+)/gi,
            "<a href=\"$1\" target='_blank '>$1<\/a>");
        str = str.replace(/\b(www\.[\w+\.\:\/\_]+)/gi,
            "<a href=\"http://$1\" target='_blank '>$1</a>");
        str = str.replace(/\bhttp\:\/\/&not;¤&cedil;(\.[\w+\.\:\/\_]+)/gi,
            "<a href=\"http\:\/\/www$1\" target='_blank '>http\:\/\/www$1</a>");

        return str;

    }


    function reqRG() {

        var data = {
            MsgType: "event.CLICK.RG"
        };
        var result;
        result = $.ajax({
            url: "/sendmsg",
            type: "POST",
            cache: false,
            dataType: "json",
            data: JSON.stringify(data),
            contentType: 'application/json; charset=UTF-8',
            timeout: 60000,
            success: function (data, status, xhr) {
                if (data) {
                    if (data.desc) {
                        displayMsg("left", data.desc);
                    }
                }
            },
            error: function (xhr, status, ex) {
                console.log(ex);

            }
        });
    }

    /*$('#btn_rg').click(function (event) {
     reqRG();
     // socket.emit('ImMessage', data);
     });*/

    $("#open_upload_img").click(function (event) {
        $("#upload_img").click();
    });

//    $("#upload_img")
    upclick(
        {
            element: "upload_img",
            action: '/uploadfile/',
            action_params: {},
            onstart: function (filename) {
                console.log("filename is ", filename);
            },
            oncomplete: function (response_data) {
                var data = response_data == "null" ? "上传成功" : response_data;
                displayMsg("left", data);

            }
        });
    function displayMsg(side, data) {
        var c = "";
        if (!$.support.optSelected) {
            //IE11
            c = "ie";
        }
        var msg = {
            side: side,
            text: data,
            avatar: side == "left" ? "./images/webchat_avater.png" : "./images/client_avater.jpg",
            class_ie: c
        }
        messages.push(msg);
        divchat.scrollTop = divchat.scrollHeight;
    }

    $("#answer_way").change(function (event) {
        if (this.value == "email") {
            $("#mail_tip").css({
                "display": ""
            });
            $("#tel_tip").css({
                "display": "none"
            });
        }
        else {
            $("#mail_tip").css({
                "display": "none"
            });
            $("#tel_tip").css({
                "display": ""
            });
        }
    });
    $("#leaveMsgFrm").submit(function (event) {
        var contact = $("#contact").val().trim();
        if (contact == "") {
            alert("联系人不能为空");
            $("#contact").focus();
            return false;
        }
        var callback = $("#answer_way").val();
        var email = $("#mail").val().trim();
        var tel = $("#tel").val().trim()
        if (callback == "email") {
            if (email == "") {
                alert("邮箱不能为空");
                $("#mail").focus();
                return false;
            }
        } else {
            if (tel == "") {
                alert("电话不能为空");
                $("#tel").focus();
                return false;
            }
        }
        var subject = $("#subject").val();
        if (subject == "") {
            alert("留言主题不能为空");
            $("#subject").focus();
            return false;
        }
        // 格式校验
        if (email != "") {
            if (/^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(email) === false) {
                alert("邮箱格式不正确");
                $("#email").focus();
                return false;
            }
        }
        if (tel != "") {
            if (/(^1[3-8][0-9][0-9]{8}$)|(^(0((10)|(2[0-9])|([3-9][0-9]{2})))([2-9][0-9]{6,7})$)/.test(tel) === false) {
                alert("手机或电话号码格式不正确");
                $("#tel").focus();
                return false;
            }
        }
        //
        var data = {
            user_id: null,
            contact: contact,
            callback: callback,
            tel: tel,
            email: email,
            subject: subject,
            content: $("#leave_message_content").val(),
            user_data: {}
        }

        var result;
        result = $.ajax({
            url: "/savemessages",
            type: "POST",
            cache: false,
            dataType: "json",
            data: JSON.stringify(data),
            contentType: 'application/json; charset=UTF-8',
            timeout: 60000,
            success: function (data, status, xhr) {
                if (data.desc) {
                    alert(data.desc);
                }
                $("#leave_msg_reset").click();
            },
            error: function (xhr, status, ex) {
                console.log(ex);
            }
        });
        return false;
    });

    /**
     */
    $("#leave_msg_reset").on("click", function (event) {
        event.preventDefault();
        $("#leaveMsgFrm")[0].reset();
        var selectelement = $("#answer_way")[0];
        if ("createEvent" in document) {
            var evt = document.createEvent("HTMLEvents");
            evt.initEvent("change", false, true);
            selectelement.dispatchEvent(evt);
        } else {
            selectelement.fireEvent("onchange");
        }
    });
    /*    $.bind('beforeunload',function(){
     alert("禁止刷新");
     return false;

     })*/
    window.onbeforeunload = function (event) {
        return "关闭或重新加载将导致此次人工服务停止";
        /*  if(event.clientX>document.body.clientWidth && event.clientY < 0 || event.altKey){
         alert("你关闭了浏览器");
         }else{
         alert("你正在刷新页面");
         }*/
    }
});


