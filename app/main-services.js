'use strict';

const CastClient = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const EventEmitter = require('events').EventEmitter;
const mdns = require('mdns');
const request = require('request');

const
    BUFFERING = 'BUFFERING',
    PAUSED = 'PAUSED',
    PLAYING = 'PLAYING',
    REPEAT_OFF = 'REPEAT_OFF',
    REPEAT_ON = 'REPEAT_ON'
    ;

class Services extends EventEmitter {
    constructor() {
        super();

        this.client = null;
        // Latest IPC event
        this.event = null;
        this.list = new Map();
        this.url = '';

        // Device Browser
        try {
            this.browser = mdns.createBrowser(mdns.tcp('googlecast'));
            this.browser.on('serviceUp', this.handleServiceUp.bind(this));
        } catch (e) {
            // On contents reload, mdns is already running
            console.error(e);
        }
    }

    handleDevice(host) {
        this.client = new CastClient();
        this.client.connect(host, this.handleConnect.bind(this));
    }

    handleConnect() {
        console.log('Connected, launching...');
        this.client.launch(DefaultMediaReceiver, this.handleLaunch.bind(this));
    }

    handleHeaders(err, res) {
        console.log(' - HEAD ', res.headers);

        let media = {
            // Here you can plug an URL to any mp4, webm, mp3 or jpg file with the proper contentType.
            contentId: this.url,
            contentType: res.headers['content-type'],
            streamType: 'BUFFERED', // or LIVE
            // Title and cover displayed while buffering
            metadata: {
                type: 0,
                metadataType: 0,
                title: 'Chromecast Stream',
                images: [
                    {
                        // TODO replace with CC icon
                        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg'
                    }
                ]
            }
        };

        console.log('App "%s" is launched, loading media: "%s"', this.player.session.displayName, media.contentId);
        this.player.load(media, { autoplay: true }, this.handleLoadFile.bind(this));
    }

    handleLaunch(err, player) {
        player.on('status', this.handleStatus.bind(this));
        this.player = player;
    }

    handleLoadFile(err, status) {
        console.log('Media loaded playerState=%s', status.playerState);

        // if (this.event) {
        //     this.event.sender.send('playing', this.url);
        // }

        // Seek to 2 minutes after 15 seconds playing.
        // setTimeout(function() {
        //   player.seek(2*60, function(err, status) {
        //     //
        //   });
        // }, 15000);
    }

    handleServiceUp(service) {
        let address = service.addresses[0];
        console.log('Found device "%s" at %s:%d', service.name, address, service.port);
        console.log(service);

        this.list.set(address, service);
        this.handleDevice.call(this, address);
        this.emit('service', service);
    }

    handleStatus(status) {
        this.emit('status', status);
    }

    handleStatusCallback() {
        console.log('handleStatusCallback()', arguments);
    }

    browse() {
        try {
            this.browser.start();
        } catch (e) {
            // On contents reload, mdns is already running
            console.error(e);
        }
    }

    load(url, event) {
        this.url = url;
        this.event = event;
        // this.player.getStatus(this.handleStatusCallback);
        request(url, { method: 'HEAD' }, this.handleHeaders.bind(this));
    }

    pause() {
        if (this.player) {
            this.player.pause(this.handleStatusCallback);
        }
    }

    play() {
        if (this.player) {
            this.player.play(this.handleStatusCallback);
        }
    }

    stop() {
        if (this.player) {
            this.player.stop(this.handleStatusCallback);
        }
    }

    close() {
        if (this.client) {
            // this.client.close();
            this.client.emit('close');
        }
    }
}

module.exports = new Services();