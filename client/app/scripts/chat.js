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

        var d = $("#divcontent");
        d.removeClass("divcontent");
        d.addClass("divcontent_ie8");
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
    function authed() {
        var result;
        result = $.ajax({
            url: "/authed",
            type: "get",
            cache: false,
            dataType: "json",
            contentType: 'application/json; charset=UTF-8',
            timeout: 60000,
            success: function (data, status, xhr) {
                if (data.authed) {
                    $("#d_captcha")[0].style.display = "none";
                    init_sockio();
                    tip("请输入您要咨询的问题，按ctrl+enter发送");
                } else {
                    $("#d_captcha")[0].style.display = "";
                    tip("请通过验证后再输入您要咨询的内容，按ctrl+enter发送");
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
            url: "/captcha",
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
        socket = io();
        /**
         接收消息
         */
        socket.on('ImMessage', function (data) {
            console.log(data);
            var content = parse_content(data.Content);
            console.log(content);
            var regRN = /\r\n/g;
            content = content.replace(regRN, "<br />");
            var regR = /\r/g;
            var regN = /\n/g;
            content = content.replace(regR, "<br />").replace(regN, "<br />");
            content = reg_email(content);
            displayMsg({
                side: 'left',
                text: content,
                avatar: 'http://img0.bdstatic.com/img/image/shouye/mxlss33-11681559436.jpg'
            });
        });
        // reqRG();
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

        displayMsg({
            side: 'right',
            text: reg_email(reg_http(parse_content(msg))),
            avatar: 'http://pic.baike.soso.com/p/20130309/bki-20130309223642-2077810791.jpg'
        });
        var data = {
            FromUserName: '光头强',
            MsgType: 'text',
            Content: msg
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
                        displayMsg({
                            side: 'left',
                            text: data.desc,
                            avatar: 'http://img0.bdstatic.com/img/image/shouye/mxlss33-11681559436.jpg'
                        });
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
                        displayMsg({
                            side: 'left',
                            text: data.desc,
                            avatar: 'http://img0.bdstatic.com/img/image/shouye/mxlss33-11681559436.jpg'
                        });
                    }
                }
            },
            error: function (xhr, status, ex) {
                console.log(ex);

            }
        });
    }

    $('#btn_rg').click(function (event) {
        reqRG();
        // socket.emit('ImMessage', data);
    });

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
                displayMsg({
                    side: 'left',
                    text: data,
                    avatar: 'http://img0.bdstatic.com/img/image/shouye/mxlss33-11681559436.jpg'
                });

            }
        });
    function displayMsg(msg) {
        messages.push(msg);
        divchat.scrollTop = divchat.scrollHeight;
    }

    $("#answer_way").change(function (event) {
        if (this.value == "mail") {
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
    $("#msgFrm").submit(function (event) {
        var data={
            user_id:null,
            contact:$("#contact").val().trim(),
            callback:$("#answer_way").val(),
            tel:$("#tel").val().trim(),
            email:$("#mail").val().trim(),
            subject:$("#subject").val(),
            content:$("#leave_message_content").val(),
            user_data:{}
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
                if (data) {
                    if (data.desc) {
                        displayMsg({
                            side: 'left',
                            text: data.desc,
                            avatar: 'http://img0.bdstatic.com/img/image/shouye/mxlss33-11681559436.jpg'
                        });
                    }
                }
            },
            error: function (xhr, status, ex) {
                console.log(ex);

            }
        });
        return false;
    });
    /* displayMsg(
     {
     side: 'left',
     text: "您好，欢迎进入TCL客户服务中心！",
     avatar: 'http://img0.bdstatic.com/img/image/shouye/mxlss33-11681559436.jpg'
     }
     );*/
});


