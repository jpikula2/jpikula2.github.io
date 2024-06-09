const startButton = document.getElementById('startButton');
const shareScreenButton = document.getElementById('shareScreenButton');
const setRemoteSDPButton = document.getElementById('setRemoteSDPButton');
const addRemoteICEButton = document.getElementById('addRemoteICEButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const cameraSelect = document.getElementById('cameraSelect');
const localSDPTextArea = document.getElementById('localSDP');
const remoteSDPTextArea = document.getElementById('remoteSDP');
const localICETextArea = document.getElementById('localICE');
const remoteICETextArea = document.getElementById('remoteICE');

let localStream;
let remoteStream;
let peerConnection;
const servers = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        }
    ]
};

const getCameras = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    cameraSelect.innerHTML = '';
    videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${index + 1}`;
        cameraSelect.appendChild(option);
    });
};

const getStream = async (deviceId) => {
    const constraints = {
        video: { deviceId: deviceId ? { exact: deviceId } : undefined },
        audio: true
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
};

startButton.onclick = async () => {
    const selectedDeviceId = cameraSelect.value;
    localStream = await getStream(selectedDeviceId);
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            localICETextArea.value += JSON.stringify(event.candidate) + '\n';
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    localSDPTextArea.value = JSON.stringify(peerConnection.localDescription);
};

setRemoteSDPButton.onclick = async () => {
    const remoteSDP = JSON.parse(remoteSDPTextArea.value);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteSDP));
    if (remoteSDP.type === 'offer') {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        localSDPTextArea.value = JSON.stringify(peerConnection.localDescription);
    }
};

addRemoteICEButton.onclick = async () => {
    const remoteICECandidates = remoteICETextArea.value.split('\n');
    for (let candidate of remoteICECandidates) {
        if (candidate.trim()) {
            try {
                await peerConnection.addIceCandidate(JSON.parse(candidate));
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        }
    }
};

shareScreenButton.onclick = async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];

    const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
    sender.replaceTrack(screenTrack);

    screenTrack.onended = () => {
        const localVideoTrack = localStream.getVideoTracks()[0];
        sender.replaceTrack(localVideoTrack);
    };
};

getCameras();
cameraSelect.onchange = async () => {
    const selectedDeviceId = cameraSelect.value;
    if (localStream) {
        const newStream = await getStream(selectedDeviceId);
        localStream.getTracks().forEach(track => track.stop());
        localStream = newStream;
        localVideo.srcObject = localStream;

        const videoTrack = localStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        sender.replaceTrack(videoTrack);
    }
};
