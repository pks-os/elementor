import screenfull from './screenfull';

module.exports = elementorModules.ViewModule.extend( {
	oldAspectRatio: null,

	oldAnimation: null,

	swiper: null,

	player: null,

	getDefaultSettings: function() {
		return {
			classes: {
				aspectRatio: 'elementor-aspect-ratio-%s',
				item: 'elementor-lightbox-item',
				image: 'elementor-lightbox-image',
				videoContainer: 'elementor-video-container',
				videoWrapper: 'elementor-fit-aspect-ratio',
				playButton: 'elementor-custom-embed-play',
				playButtonIcon: 'fa',
				playing: 'elementor-playing',
				hidden: 'elementor-hidden',
				invisible: 'elementor-invisible',
				preventClose: 'elementor-lightbox-prevent-close',
				slideshow: {
					container: 'swiper-container',
					slidesWrapper: 'swiper-wrapper',
					prevButton: 'elementor-swiper-button elementor-swiper-button-prev',
					nextButton: 'elementor-swiper-button elementor-swiper-button-next',
					prevButtonIcon: 'eicon-chevron-left',
					nextButtonIcon: 'eicon-chevron-right',
					slide: 'swiper-slide',
					header: 'elementor-slideshow__header',
					footer: 'elementor-slideshow__footer',
					title: 'elementor-slideshow__title',
					description: 'elementor-slideshow__description',
					counter: 'elementor-slideshow__counter',
					iconExpand: 'eicon-frame-expand',
					iconShrink: 'eicon-frame-minimize',
					iconZoomIn: 'eicon-zoom-in-bold',
					iconZoomOut: 'eicon-zoom-out-bold',
					iconShare: 'eicon-share-arrow',
					shareMenu: 'elementor-slideshow__share-menu',
					shareLinks: 'elementor-slideshow__share-links',
					hideUiVisibility: 'elementor-slideshow--ui-hidden',
					shareMode: 'elementor-slideshow--share-mode',
					fullscreenMode: 'elementor-slideshow--fullscreen-mode',
					zoomMode: 'elementor-slideshow--zoom-mode',
				},
			},
			selectors: {
				links: 'a, [data-elementor-lightbox]',
				slideshow: {
					activeSlide: '.swiper-slide-active',
					prevSlide: '.swiper-slide-prev',
					nextSlide: '.swiper-slide-next',
				},
			},
			modalOptions: {
				id: 'elementor-lightbox',
				entranceAnimation: 'zoomIn',
				videoAspectRatio: 169,
				position: {
					enable: false,
				},
			},
		};
	},

	getModal: function() {
		if ( ! module.exports.modal ) {
			this.initModal();
		}

		return module.exports.modal;
	},

	initModal: function() {
		const modal = module.exports.modal = elementorFrontend.getDialogsManager().createWidget( 'lightbox', {
			className: 'elementor-lightbox',
			closeButton: true,
			closeButtonClass: 'eicon-close',
			selectors: {
				preventClose: '.' + this.getSettings( 'classes.preventClose' ),
			},
			hide: {
				onClick: true,
			},
		} );

		modal.on( 'hide', function() {
			modal.setMessage( '' );
		} );
	},

	showModal: function( options ) {
		const $closeButton = this.getModal().getElements( 'closeButton' );

		this.buttons = [ $closeButton[ 0 ] ];

		this.focusedButton = null;

		const self = this,
			defaultOptions = self.getDefaultSettings().modalOptions;

		self.id = options.id;

		self.setSettings( 'modalOptions', jQuery.extend( defaultOptions, options.modalOptions ) );

		const modal = self.getModal();

		modal.setID( self.getSettings( 'modalOptions.id' ) );

		modal.onShow = function() {
			DialogsManager.getWidgetType( 'lightbox' ).prototype.onShow.apply( modal, arguments );

			self.setEntranceAnimation();
		};

		modal.onHide = function() {
			DialogsManager.getWidgetType( 'lightbox' ).prototype.onHide.apply( modal, arguments );

			modal.getElements( 'message' ).removeClass( 'animated' );

			if ( screenfull.isFullscreen ) {
				self.deactivateFullscreen();
			}

			self.unbindHotKeys();
		};

		switch ( options.type ) {
			case 'video':
				self.setVideoContent( options );

				break;
			case 'image':
				const slides = [ {
					image: options.url,
					index: 0,
					title: options.title,
					description: options.description,
				} ];

				options.slideshow = {
					slides,
					swiper: {
						loop: false,
						pagination: false,
					},
				};
			case 'slideshow':
				self.setSlideshowContent( options.slideshow );

				break;
			default:
				self.setHTMLContent( options.html );
		}

		modal.show();
	},

	setHTMLContent: function( html ) {
		this.getModal().setMessage( html );
	},

	setVideoContent: function( options ) {
		const $ = jQuery,
			classes = this.getSettings( 'classes' ),
			$videoContainer = $( '<div>', { class: `${ classes.videoContainer } ${ classes.preventClose }` } ),
			$videoWrapper = $( '<div>', { class: classes.videoWrapper } ),
			modal = this.getModal();

		let $videoElement;

		if ( 'hosted' === options.videoType ) {
			const videoParams = $.extend( { src: options.url, autoplay: '' }, options.videoParams );

			$videoElement = $( '<video>', videoParams );
		} else {
			const videoURL = options.url.replace( '&autoplay=0', '' ) + '&autoplay=1';

			$videoElement = $( '<iframe>', { src: videoURL, allowfullscreen: 1 } );
		}

		$videoContainer.append( $videoWrapper );

		$videoWrapper.append( $videoElement );

		modal.setMessage( $videoContainer );

		this.setVideoAspectRatio();

		const onHideMethod = modal.onHide;

		modal.onHide = function() {
			onHideMethod();

			this.buttons = [];
			this.focusedButton = null;

			modal.getElements( 'message' ).removeClass( 'elementor-fit-aspect-ratio' );
		};
	},

	getShareLinks: function() {
		const { i18n } = elementorFrontend.config,
			socialNetworks = {
				facebook: i18n.shareOnFacebook,
				twitter: i18n.shareOnTwitter,
				pinterest: i18n.pinIt,
			},
			$ = jQuery,
			classes = this.getSettings( 'classes' ),
			$linkList = $( '<div>', { class: classes.slideshow.shareLinks } ),
			$activeSlide = this.getSlide( 'active' ),
			$image = $activeSlide.find( '.' + classes.image ),
			videoUrl = $activeSlide.data( 'elementor-slideshow-video' );

		let itemUrl;

		if ( videoUrl ) {
			itemUrl = videoUrl;
		} else {
			itemUrl = $image.attr( 'src' );
		}

		$.each( socialNetworks, ( key, networkLabel ) => {
			const $link = $( '<a>', { href: this.createShareLink( key, itemUrl ), target: '_blank' } ).text( networkLabel );

			$link.prepend( $( '<i>', { class: 'eicon-' + key } ) );
			$linkList.append( $link );
		} );

		if ( ! videoUrl ) {
			$linkList.append( $( '<a>', { href: itemUrl, download: '' } )
				.text( i18n.downloadImage )
				.prepend( $( '<i>', { class: 'eicon-download-bold', 'aria-label': i18n.download } ) ) );
		}

		return $linkList;
	},

	createShareLink: function( networkName, itemUrl ) {
		const options = {};

		if ( 'pinterest' === networkName ) {
			options.image = encodeURIComponent( itemUrl );
		} else {
			const hash = elementorFrontend.utils.urlActions.createActionHash( 'lightbox', {
				id: this.id,
				url: itemUrl,
			} );

			options.url = encodeURIComponent( location.href.replace( /#.*/, '' ) ) + hash;
		}

		return ShareLink.getNetworkLink( networkName, options );
	},

	getSlideshowHeader: function() {
		const { i18n } = elementorFrontend.config;
		const $ = jQuery,
			showCounter = 'yes' === elementorFrontend.getGeneralSettings( 'elementor_lightbox_enable_counter' ),
			showFullscreen = 'yes' === elementorFrontend.getGeneralSettings( 'elementor_lightbox_enable_fullscreen' ),
			showZoom = 'yes' === elementorFrontend.getGeneralSettings( 'elementor_lightbox_enable_zoom' ),
			showShare = 'yes' === elementorFrontend.getGeneralSettings( 'elementor_lightbox_enable_share' ),
			classes = this.getSettings( 'classes' ),
			slideshowClasses = classes.slideshow,
			elements = this.elements;

		if ( ! ( showCounter || showFullscreen || showZoom || showShare ) ) {
			return;
		}

		elements.$header = $( '<header>', { class: slideshowClasses.header + ' ' + classes.preventClose } );

		if ( showShare ) {
			elements.$iconShare = $( '<i>', {
				class: slideshowClasses.iconShare,
				role: 'button',
				'aria-label': i18n.share,
				'aria-expanded': false,
			} ).append( $( '<span>' ) );
			const $shareLinks = $( '<div>' );
			$shareLinks.on( 'click', ( e ) => {
				e.stopPropagation();
			} );
			elements.$shareMenu = $( '<div>', { class: slideshowClasses.shareMenu } ).append( $shareLinks );
			elements.$iconShare.add( elements.$shareMenu ).on( 'click', this.toggleShareMenu );
			elements.$header.append( elements.$iconShare, elements.$shareMenu );
			this.buttons.push( elements.$iconShare[ 0 ] );
		}

		if ( showZoom ) {
			elements.$iconZoom = $( '<i>', {
				class: slideshowClasses.iconZoomIn,
				role: 'switch',
				'aria-checked': false,
				'aria-label': i18n.zoom,
			} );
			elements.$iconZoom.on( 'click', this.toggleZoomMode );
			elements.$header.append( elements.$iconZoom );
			this.buttons.push( elements.$iconZoom[ 0 ] );
		}

		if ( showFullscreen ) {
			elements.$iconExpand = $( '<i>', {
				class: slideshowClasses.iconExpand,
				role: 'switch',
				'aria-checked': false,
				'aria-label': i18n.fullscreen,
			} ).append( $( '<span>' ), $( '<span>' ) );
			elements.$iconExpand.on( 'click', this.toggleFullscreen );
			elements.$header.append( elements.$iconExpand );
			this.buttons.push( elements.$iconExpand[ 0 ] );
		}

		if ( showCounter ) {
			elements.$counter = $( '<span>', { class: slideshowClasses.counter } );
			elements.$header.append( elements.$counter );
		}

		return elements.$header;
	},

	toggleFullscreen: function() {
		if ( screenfull.isFullscreen ) {
			this.deactivateFullscreen();
		} else if ( screenfull.isEnabled ) {
			this.activateFullscreen();
		}
	},

	toggleZoomMode: function() {
		if ( 1 !== this.swiper.zoom.scale ) {
			this.deactivateZoom();
		} else {
			this.activateZoom();
		}
	},

	toggleShareMenu: function() {
		const classes = this.getSettings( 'classes' );
		if ( this.elements.$container.hasClass( classes.slideshow.shareMode ) ) {
			this.deactivateShareMode();
			this.elements.$shareMenu
				.attr( 'aria-expanded', false );
		} else {
			this.elements.$shareMenu
				.html( this.getShareLinks() )
				.attr( 'aria-expanded', true );
			this.activateShareMode();
		}
	},

	activateShareMode: function() {
		const classes = this.getSettings( 'classes' );
		this.elements.$container.addClass( classes.slideshow.shareMode );
		this.elements.$iconShare.attr( 'aria-expanded', true );
		this.swiper.detachEvents();
		// Temporarily replace tabbable buttons with share-menu items
		this.originalButtons = this.buttons;
		this.buttons = [ this.elements.$iconShare[ 0 ] ].concat( this.elements.$shareMenu.find( 'a' ).toArray() );
	},

	deactivateShareMode: function() {
		const classes = this.getSettings( 'classes' );
		this.elements.$container.removeClass( classes.slideshow.shareMode );
		this.elements.$iconShare.attr( 'aria-expanded', false );
		this.swiper.attachEvents();
		this.buttons = this.originalButtons;
	},

	activateFullscreen: function() {
		const classes = this.getSettings( 'classes' );
		screenfull.request( this.elements.$container.parents( '.dialog-widget' )[ 0 ] );
		this.elements.$iconExpand.removeClass( classes.slideshow.iconExpand )
			.addClass( classes.slideshow.iconShrink )
			.attr( 'aria-checked', 'true' );
		this.elements.$container.addClass( classes.slideshow.fullscreenMode );
	},

	deactivateFullscreen: function() {
		const classes = this.getSettings( 'classes' );
		screenfull.exit();
		this.elements.$iconExpand.removeClass( classes.slideshow.iconShrink )
			.addClass( classes.slideshow.iconExpand )
			.attr( 'aria-checked', 'false' );
		this.elements.$container.removeClass( classes.slideshow.fullscreenMode );
	},

	activateZoom: function() {
		const swiper = this.swiper,
			elements = this.elements,
			classes = this.getSettings( 'classes' );

		swiper.zoom.in();
		swiper.allowSlideNext = false;
		swiper.allowSlidePrev = false;
		swiper.allowTouchMove = false;
		elements.$container.addClass( classes.slideshow.zoomMode );
		elements.$iconZoom.removeClass( classes.slideshow.iconZoomIn ).addClass( classes.slideshow.iconZoomOut );
	},

	deactivateZoom: function() {
		const swiper = this.swiper,
			elements = this.elements,
			classes = this.getSettings( 'classes' );

		swiper.zoom.out();
		swiper.allowSlideNext = true;
		swiper.allowSlidePrev = true;
		swiper.allowTouchMove = true;
		elements.$container.removeClass( classes.slideshow.zoomMode );
		elements.$iconZoom.removeClass( classes.slideshow.iconZoomOut ).addClass( classes.slideshow.iconZoomIn );
	},

	getSlideshowFooter: function() {
		const $ = jQuery,
			classes = this.getSettings( 'classes' ),
			$footer = $( '<footer>', { class: classes.slideshow.footer + ' ' + classes.preventClose } ),
			$title = $( '<div>', { class: classes.slideshow.title } ),
			$description = $( '<div>', { class: classes.slideshow.description } );

		$footer.append( $title, $description );

		return $footer;
	},

	setSlideshowContent: function( options ) {
		const { i18n } = elementorFrontend.config;
		const $ = jQuery,
			isSingleSlide = 1 === options.slides.length,
			hasTitle = '' !== elementorFrontend.getGeneralSettings( 'elementor_lightbox_title_src' ),
			hasDescription = '' !== elementorFrontend.getGeneralSettings( 'elementor_lightbox_description_src' ),
			showFooter = hasTitle || hasDescription,
			classes = this.getSettings( 'classes' ),
			slideshowClasses = classes.slideshow,
			$container = $( '<div>', { class: slideshowClasses.container } ),
			$slidesWrapper = $( '<div>', { class: slideshowClasses.slidesWrapper } );

		let $prevButton, $nextButton;

		options.slides.forEach( ( slide ) => {
			let slideClass = slideshowClasses.slide + ' ' + classes.item;

			if ( slide.video ) {
				slideClass += ' ' + classes.video;
			}

			const $slide = $( '<div>', { class: slideClass } );

			if ( slide.video ) {
				$slide.attr( 'data-elementor-slideshow-video', slide.video );

				const $playIcon = $( '<div>', { class: classes.playButton } ).html( $( '<i>', { class: classes.playButtonIcon, 'aria-label': i18n.playVideo } ) );

				$slide.append( $playIcon );
			} else {
				const $zoomContainer = $( '<div>', { class: 'swiper-zoom-container' } ),
					$slidePlaceholder = $( '<div class="swiper-lazy-preloader"></div>' ),
					imageAttributes = {
						'data-src': slide.image,
						class: classes.image + ' ' + classes.preventClose + ' swiper-lazy',
					};

				if ( slide.title ) {
					imageAttributes[ 'data-title' ] = slide.title;
					imageAttributes.alt = slide.title;
				}

				if ( slide.description ) {
					imageAttributes[ 'data-description' ] = slide.description;
					imageAttributes.alt += ' - ' + slide.description;
				}

				const $slideImage = $( '<img>', imageAttributes );

				$zoomContainer.append( [ $slideImage, $slidePlaceholder ] );
				$slide.append( $zoomContainer );
			}

			$slidesWrapper.append( $slide );
		} );

		this.elements.$container = $container;
		this.elements.$header = this.getSlideshowHeader();

		$container
			.prepend( this.elements.$header )
			.append( $slidesWrapper );

		if ( ! isSingleSlide ) {
			$prevButton = $( '<div>', { class: slideshowClasses.prevButton + ' ' + classes.preventClose, 'aria-label': i18n.previous } ).html( $( '<i>', { class: slideshowClasses.prevButtonIcon } ) );
			$nextButton = $( '<div>', { class: slideshowClasses.nextButton + ' ' + classes.preventClose, 'aria-label': i18n.next } ).html( $( '<i>', { class: slideshowClasses.nextButtonIcon } ) );

			$container.append(
				$nextButton,
				$prevButton,
			);

			this.buttons.push( $nextButton[ 0 ], $prevButton[ 0 ] );
		}

		if ( showFooter ) {
			this.elements.$footer = this.getSlideshowFooter();
			$container.append( this.elements.$footer );
		}

		this.setSettings( 'hideUiTimeout', '' );

		$container.on( 'click mousemove keypress', this.showLightboxUi );

		const modal = this.getModal();

		modal.setMessage( $container );

		const onShowMethod = modal.onShow;

		modal.onShow = () => {
			onShowMethod();

			const swiperOptions = {
				pagination: {
					el: '.' + slideshowClasses.counter,
					type: 'fraction',
				},
				on: {
					slideChangeTransitionEnd: this.onSlideChange,
				},
				lazy: {
					loadPrevNext: true,
				},
				zoom: true,
				spaceBetween: 100,
				grabCursor: true,
				runCallbacksOnInit: false,
				loop: true,
				keyboard: true,
				handleElementorBreakpoints: true,
			};

			if ( ! isSingleSlide ) {
				swiperOptions.navigation = {
					prevEl: $prevButton,
					nextEl: $nextButton,
				};
			}

			if ( options.swiper ) {
				$.extend( swiperOptions, options.swiper );
			}

			this.swiper = new Swiper( $container, swiperOptions );

			// Expose the swiper instance in the frontend
			$container.data( 'swiper', this.swiper );

			this.setVideoAspectRatio();

			this.playSlideVideo();

			if ( showFooter ) {
				this.updateFooterText();
			}

			this.bindHotKeys();

			jQuery.each( this.buttons, ( index, item ) => {
				jQuery( item )
					.attr( 'tabindex', 0 )
					.keypress( ( event ) => {
						if ( 13 === event.which || 32 === event.which ) {
							jQuery( item ).trigger( 'click' );
						}
					} );
			} );
		};
	},

	showLightboxUi: function() {
		const slideshowClasses = this.getSettings( 'classes' ).slideshow,
			$container = this.elements.$container;
		clearTimeout( this.getSettings( 'hideUiTimeout' ) );
		this.elements.$container.removeClass( slideshowClasses.hideUiVisibility );
		this.setSettings( 'hideUiTimeout', setTimeout( () => {
			if ( ! $container.hasClass( slideshowClasses.shareMode ) ) {
				$container.addClass( slideshowClasses.hideUiVisibility );
			}
		}, 3500 ) );
	},

	bindHotKeys: function() {
		this.getModal().getElements( 'window' ).on( 'keydown', this.activeKeyDown );
	},

	unbindHotKeys: function() {
		this.getModal().getElements( 'window' ).off( 'keydown', this.activeKeyDown );
	},

	activeKeyDown: function( event ) {
		this.showLightboxUi();

		const TAB_KEY = 9;

		if ( event.which === TAB_KEY ) {
			const buttons = this.buttons;

			let focusedButton,
				isFirst,
				isLast;

			jQuery.each( buttons, ( index, item ) => {
				if ( jQuery( item ).is( ':focus' ) ) {
					focusedButton = buttons[ index ];
					isFirst = 0 === index;
					isLast = buttons.length - 1 === index;
					return false;
				}
			} );

			if ( event.shiftKey ) {
				if ( isFirst ) {
					event.preventDefault();
					// Go to last button
					buttons[ buttons.length - 1 ].focus();
				}
			} else if ( isLast || ! focusedButton ) {
				event.preventDefault();
				// Go to first button
				buttons[ 0 ].focus();
			}
		}
	},

	setVideoAspectRatio: function( aspectRatio ) {
		aspectRatio = aspectRatio || this.getSettings( 'modalOptions.videoAspectRatio' );

		const $widgetContent = this.getModal().getElements( 'widgetContent' ),
			oldAspectRatio = this.oldAspectRatio,
			aspectRatioClass = this.getSettings( 'classes.aspectRatio' );

		this.oldAspectRatio = aspectRatio;

		if ( oldAspectRatio ) {
			$widgetContent.removeClass( aspectRatioClass.replace( '%s', oldAspectRatio ) );
		}

		if ( aspectRatio ) {
			$widgetContent.addClass( aspectRatioClass.replace( '%s', aspectRatio ) );
		}
	},

	getSlide: function( slideState ) {
		return jQuery( this.swiper.slides ).filter( this.getSettings( 'selectors.slideshow.' + slideState + 'Slide' ) );
	},

	updateFooterText: function() {
		if ( ! this.elements.$footer ) {
			return;
		}

		const classes = this.getSettings( 'classes' ),
			$activeSlide = this.getSlide( 'active' ),
			$image = $activeSlide.find( '.elementor-lightbox-image' ),
			titleText = $image.data( 'title' ),
			descriptionText = $image.data( 'description' ),
			$title = this.elements.$footer.find( '.' + classes.slideshow.title ),
			$description = this.elements.$footer.find( '.' + classes.slideshow.description );

		$title.text( titleText || '' );
		$description.text( descriptionText || '' );
	},

	playSlideVideo: function() {
		const $activeSlide = this.getSlide( 'active' ),
			videoURL = $activeSlide.data( 'elementor-slideshow-video' );

		if ( ! videoURL ) {
			return;
		}

		const classes = this.getSettings( 'classes' ),
			$videoContainer = jQuery( '<div>', { class: classes.videoContainer + ' ' + classes.invisible } ),
			$videoWrapper = jQuery( '<div>', { class: classes.videoWrapper } ),
			$playIcon = $activeSlide.children( '.' + classes.playButton );

		let videoType, apiProvider;

		$videoContainer.append( $videoWrapper );

		$activeSlide.append( $videoContainer );

		if ( -1 !== videoURL.indexOf( 'vimeo.com' ) ) {
			videoType = 'vimeo';
			apiProvider = elementorFrontend.utils.vimeo;
		} else if ( videoURL.match( /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|youtube\.com)/ ) ) {
			videoType = 'youtube';
			apiProvider = elementorFrontend.utils.youtube;
		}

		const videoID = apiProvider.getVideoIDFromURL( videoURL );

		apiProvider.onApiReady( ( apiObject ) => {
			if ( 'youtube' === videoType ) {
				this.prepareYTVideo( apiObject, videoID, $videoContainer, $videoWrapper, $playIcon );
			} else if ( 'vimeo' === videoType ) {
				this.prepareVimeoVideo( apiObject, videoID, $videoContainer, $videoWrapper, $playIcon );
			}
		} );

		$playIcon.addClass( classes.playing ).removeClass( classes.hidden );
	},

	prepareYTVideo: function( YT, videoID, $videoContainer, $videoWrapper, $playIcon ) {
		const classes = this.getSettings( 'classes' ),
			$videoPlaceholderElement = jQuery( '<div>' );
		let startStateCode = YT.PlayerState.PLAYING;

		$videoWrapper.append( $videoPlaceholderElement );

		// Since version 67, Chrome doesn't fire the `PLAYING` state at start time
		if ( window.chrome ) {
			startStateCode = YT.PlayerState.UNSTARTED;
		}

		$videoContainer.addClass( 'elementor-loading' + ' ' + classes.invisible );

		this.player = new YT.Player( $videoPlaceholderElement[ 0 ], {
			videoId: videoID,
			events: {
				onReady: () => {
					$playIcon.addClass( classes.hidden );

					$videoContainer.removeClass( classes.invisible );

					this.player.playVideo();
				},
				onStateChange: ( event ) => {
					if ( event.data === startStateCode ) {
						$videoContainer.removeClass( 'elementor-loading' + ' ' + classes.invisible );
					}
				},
			},
			playerVars: {
				controls: 0,
				rel: 0,
			},
		} );
	},

	prepareVimeoVideo: function( Vimeo, videoId, $videoContainer, $videoWrapper, $playIcon ) {
		const classes = this.getSettings( 'classes' ),
			vimeoOptions = {
				id: videoId,
				autoplay: true,
				transparent: false,
				playsinline: false,
			};

		this.player = new Vimeo.Player( $videoWrapper, vimeoOptions );

		this.player.ready().then( () => {
			$playIcon.addClass( classes.hidden );

			$videoContainer.removeClass( classes.invisible );
		} );
	},

	setEntranceAnimation: function( animation ) {
		animation = animation || elementorFrontend.getCurrentDeviceSetting( this.getSettings( 'modalOptions' ), 'entranceAnimation' );

		const $widgetMessage = this.getModal().getElements( 'message' );

		if ( this.oldAnimation ) {
			$widgetMessage.removeClass( this.oldAnimation );
		}

		this.oldAnimation = animation;

		if ( animation ) {
			$widgetMessage.addClass( 'animated ' + animation );
		}
	},

	isLightboxLink: function( element ) {
		if ( 'A' === element.tagName && ( element.hasAttribute( 'download' ) || ! /^[^?]+\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test( element.href ) ) ) {
			return false;
		}

		const generalOpenInLightbox = elementorFrontend.getGeneralSettings( 'elementor_global_image_lightbox' ),
			currentLinkOpenInLightbox = element.dataset.elementorOpenLightbox;

		return 'yes' === currentLinkOpenInLightbox || ( generalOpenInLightbox && 'no' !== currentLinkOpenInLightbox );
	},

	openSlideshow: function( slideshowID, initialSlideURL ) {
		const $allSlideshowLinks = jQuery( this.getSettings( 'selectors.links' ) ).filter( ( index, element ) => {
			const $element = jQuery( element );

			return slideshowID === element.dataset.elementorLightboxSlideshow && ! $element.parent( '.swiper-slide-duplicate' ).length && ! $element.parents( '.slick-cloned' ).length;
		} );

		const slides = [];

		let initialSlideIndex = 0;

		$allSlideshowLinks.each( function() {
			const slideVideo = this.dataset.elementorLightboxVideo;

			let slideIndex = this.dataset.elementorLightboxIndex;

			if ( undefined === slideIndex ) {
				slideIndex = $allSlideshowLinks.index( this );
			}

			if ( initialSlideURL === this.href || ( slideVideo && initialSlideURL === slideVideo ) ) {
				initialSlideIndex = slideIndex;
			}

			const slideData = {
				image: this.href,
				index: slideIndex,
				title: this.dataset.elementorLightboxTitle,
				description: this.dataset.elementorLightboxDescription,
			};

			if ( slideVideo ) {
				slideData.video = slideVideo;
			}

			slides.push( slideData );
		} );

		slides.sort( ( a, b ) => a.index - b.index );

		this.showModal( {
			type: 'slideshow',
			id: slideshowID,
			modalOptions: {
				id: 'elementor-lightbox-slideshow-' + slideshowID,
			},
			slideshow: {
				slides: slides,
				swiper: {
					initialSlide: +initialSlideIndex,
				},
			},
		} );
	},

	openLink: function( event ) {
		const element = event.currentTarget,
			$target = jQuery( event.target ),
			editMode = elementorFrontend.isEditMode(),
			isClickInsideElementor = ! ! $target.closest( '.elementor-edit-area' ).length;

		if ( ! this.isLightboxLink( element ) ) {
			if ( editMode && isClickInsideElementor ) {
				event.preventDefault();
			}

			return;
		}

		event.preventDefault();

		if ( editMode && ! elementor.getPreferences( 'lightbox_in_editor' ) ) {
			return;
		}

		let lightboxData = {};

		if ( element.dataset.elementorLightbox ) {
			lightboxData = JSON.parse( element.dataset.elementorLightbox );
		}

		if ( lightboxData.type && 'slideshow' !== lightboxData.type ) {
			this.showModal( lightboxData );

			return;
		}

		if ( ! element.dataset.elementorLightboxSlideshow ) {
			const slideshowID = 'single-img';

			this.showModal( {
				type: 'image',
				id: slideshowID,
				url: element.href,
				title: element.dataset.elementorLightboxTitle,
				description: element.dataset.elementorLightboxDescription,
				modalOptions: {
					id: 'elementor-lightbox-slideshow-' + slideshowID,
				},
			} );

			return;
		}

		this.openSlideshow( element.dataset.elementorLightboxSlideshow, element.href );
	},

	bindEvents: function() {
		elementorFrontend.elements.$document.on( 'click', this.getSettings( 'selectors.links' ), this.openLink );
	},

	onSlideChange: function() {
		this
			.getSlide( 'prev' )
			.add( this.getSlide( 'next' ) )
			.add( this.getSlide( 'active' ) )
			.find( '.' + this.getSettings( 'classes.videoWrapper' ) )
			.remove();

		this.playSlideVideo();

		this.updateFooterText();
	},
} );
