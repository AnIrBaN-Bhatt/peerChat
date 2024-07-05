let APP_ID = "907e4c703bd14019b20070545176e12e"

let token = null;
let uid = String(Math.floor(Math.random() * 10000));
let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if(!roomId){                                    // if user has no roomId and trying to go to index.html the it will get redirected to lobby.html
    window.location = 'lobby.html';
}


let localStream; // our camera and audio data 
let remoteStream; // other person's camera and audio data
let peerConnection;

const servers = {
    iceServers:[
        {
            urls:['stun:stun.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
} 

// let constraints = {
//     video:{
//         width:{min:640, ideal:1920, max:1920},
//         height:{min:480, ideal:480, max:1080},
//     },
//     audio:true
// }

let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

let constraints = {
    video: isMobile ? {
        width: { min: 320, ideal: 640, max: 1280 },
        height: { min: 240, ideal: 480, max: 720 },
        aspectRatio: { ideal: 1.777777778 },
        facingMode: 'user'
    } : {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        aspectRatio: { ideal: 1.777777778 },
        facingMode: 'user'
    },
    audio: true
};

let init = async () =>{
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid,token})

    channel = await client.createChannel(roomId) //createChannel finds a channel with the name specified or just create a new channel
    await channel.join()                    //joined the channel

    channel.on('MemberJoined',handleUserJoined)  //When someone else join this channel handleUserJoined is called
    client.on('MessageFromPeer',handleMessageFormPeer)      //anytime the sendMessageToPeer function gets called it gets triggered
    channel.on('MemberLeft',handleUserLeft);

    localStream = await navigator.mediaDevices.getUserMedia(constraints) // request prmission for audio and video
    document.getElementById('user-1').srcObject = localStream;
}


let handleUserLeft = async (MemberId) =>{
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame')
}

let handleMessageFormPeer = async (message,MemberId)=>{
    message = JSON.parse(message.text);
    if(message.type === 'offer'){
        createAnswer(MemberId,message.offer);
    }
    if(message.type === 'answer'){
        addAnswer(message.answer);
    }
    if(message.type === 'candidate'){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}


let handleUserJoined = async (MemberId) =>{
    console.log("New user joined the channel",MemberId);
    createOffer(MemberId);
}

let createPeerConnection = async (MemberId)=>{
    peerConnection = new RTCPeerConnection(servers);
    
    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';
    document.getElementById('user-1').classList.add('smallFrame')

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia(constraints)
        document.getElementById('user-1').srcObject = localStream;
    }
    
    localStream.getTracks().forEach((track)=>{              //loop through all the local tracks(audio and video) and add them to peerConnection
        peerConnection.addTrack(track,localStream);
    })  
    
    peerConnection.ontrack = (events) =>{                     //Ontrack adds an event listner which gets triggered                                                 
        events.streams[0].getTracks().forEach((track)=>{       //When remote peer adds any track it iterates over 
            remoteStream.addTrack(track);                    //the tracks and adds to the remote stream so that it can be played
        })
    }
    
    peerConnection.onicecandidate = async (event)=>{
        if(event.candidate)
            {
                client.sendMessageToPeer({text:JSON.stringify({'type':'candidate','candidate':event.candidate})},MemberId)
            }
        }
   
}


let createOffer = async (MemberId) =>{
        await createPeerConnection(MemberId);  
        let offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId) // sending message on client joining
    }

let createAnswer = async (MemberId,offer) =>{
    await createPeerConnection(MemberId);
    
    await peerConnection.setRemoteDescription(offer);
    
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer','answer':answer})},MemberId);
}

let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}

let leaveChannel = async ()=>{
    await channel.leave();
    await client.logout();
}


let toggleCamera = async ()=>{
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)'
    }
    else{
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249,.9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

document.getElementById('camera-btn').addEventListener('click',toggleCamera);

document.getElementById('mic-btn').addEventListener('click', toggleMic)

window.addEventListener('beforeunload',leaveChannel);





init()  // starts everything 
