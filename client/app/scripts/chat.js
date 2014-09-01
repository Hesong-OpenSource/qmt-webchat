/**
 * Created by user on 2014/8/30.
 */
var socket = null;
$(document).ready(function () {
    var emoji_pic_path='emoji/qqemoji/';
    $('.emotion').qqFace({
        id : 'facebox',
        assign:'msgTxt',
        path:emoji_pic_path	//表情存放的路径
    });

    $("body").keydown(function (event) {
        if (event.ctrlKey && event.keyCode == '13') {
            sendmsg();
        }
    });
    var divchat = $("#divcontent")[0];
    var send_msg_box = $('#msgTxt');
    $("#b_captcha").click(function () {
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
                    socket = io();
                    /**
                     接收消息
                     */
                    socket.on('ImMessage', function (data) {
                        console.log(data);
                        var content = parse_content(data.Content);
                        console.log(content);
                        messages.push({
                            side: 'left',
                            text: content,
                            avatar: 'http://img0.bdstatic.com/img/image/shouye/mxlss33-11681559436.jpg'
                        });

                        divchat.scrollTop = divchat.scrollHeight;
                    });
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


    });

    messages = [];

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
        if (msg == "") {
            tip("不能发送空消息");

            return false;
        }
        var dt = new Date();
        messages.push({
            avatar: 'http://pic.baike.soso.com/p/20130309/bki-20130309223642-2077810791.jpg',
            side: 'right',
            text: replace_em(msg)
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
                console.log(data);
            },
            error: function (xhr, status, ex) {
                console.log(ex);

            }
        });
        divchat.scrollTop = divchat.scrollHeight;
        tip("请输入您要咨询的问题，按ctrl+enter发送");

//        socket.emit('ImMessage', data);
        event.preventDefault();
    };
    function replace_em(str){
        str = str.replace(/\</g,'&lt;');
        str = str.replace(/\>/g,'&gt;');
        str = str.replace(/\n/g,'<br/>');
        str = str.replace(/\[em_([0-9]*)\]/g,'<img src="./'+emoji_pic_path+'$1.png" border="0" />');
        return str;
    }

    $('#btn_rg').click(function (event) {

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
                console.log(data);
            },
            error: function (xhr, status, ex) {
                console.log(ex);

            }
        });
        // socket.emit('ImMessage', data);
    });


});


