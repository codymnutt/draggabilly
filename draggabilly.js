/*!
 * Draggabilly v2.4.0
 * Make that shiz draggable
 * https://draggabilly.desandro.com
 * MIT license
 */

/*jshint browser: true, strict: true, undef: true, unused: true */

( function( window, factory ) {
  // universal module definition
  /* jshint strict: false */ /*globals define, module, require */
  if ( typeof define == 'function' && define.amd ) {
    // AMD
    define( [
        'get-size/get-size',
        'unidragger/unidragger'
      ],
      function( getSize, Unidragger ) {
        return factory( window, getSize, Unidragger );
      });
  } else if ( typeof module == 'object' && module.exports ) {
    // CommonJS
    module.exports = factory(
      window,
      require('get-size'),
      require('unidragger')
    );
  } else {
    // browser global
    window.Draggabilly = factory(
      window,
      window.getSize,
      window.Unidragger
    );
  }

}( window, function factory( window, getSize, Unidragger ) {

'use strict';

// -------------------------- helpers & variables -------------------------- //

// extend objects
function extend( a, b ) {
  for ( var prop in b ) {
    a[ prop ] = b[ prop ];
  }
  return a;
}

function isElement( obj ) {
  return obj instanceof HTMLElement;
}

function noop() {}

var jQuery = window.jQuery;

// --------------------------  -------------------------- //

function Draggabilly( element, options ) {
  // querySelector if string
  this.element = typeof element == 'string' ?
    document.querySelector( element ) : element;

  if ( jQuery ) {
    this.$element = jQuery( this.element );
  }

  // options
  this.options = extend( {}, this.constructor.defaults );
  this.options = extend( {scrollSpeed: 10,autoScrollThreshold: 30}, this.constructor.defaults );
  this.option( options );

  this._create();
}

// inherit Unidragger methods
var proto = Draggabilly.prototype = Object.create( Unidragger.prototype );

Draggabilly.defaults = {
};

/**
 * set options
 * @param {Object} opts
 */
proto.option = function( opts ) {
  extend( this.options, opts );
};

// css position values that don't need to be set
var positionValues = {
  relative: true,
  absolute: true,
  fixed: true
};

proto._create = function() {
  // properties
  this.position = {};
  this._getPosition();

  this.startPoint = { x: 0, y: 0 };
  this.dragPoint = { x: 0, y: 0 };

  this.startPosition = extend( {}, this.position );

  // set relative positioning
  var style = getComputedStyle( this.element );
  if ( !positionValues[ style.position ] ) {
    this.element.style.position = 'relative';
  }

  // events, bridge jQuery events from vanilla
  this.on( 'pointerDown', this.onPointerDown );
  this.on( 'pointerMove', this.onPointerMove );
  this.on( 'pointerUp', this.onPointerUp );

  this.enable();
  this.setHandles();

};

/**
 * set this.handles and bind start events to 'em
 */
proto.setHandles = function() {
  this.handles = this.options.handle ?
    this.element.querySelectorAll( this.options.handle ) : [ this.element ];

  this.bindHandles();

  if ( this.options.parentScroll ) {

       this.options.parentScroll = isElement( this.options.parentScroll ) ? this.options.parentScroll :
          // fallback to querySelector if string
          typeof this.options.parentScroll == 'string' ? document.querySelector( this.options.parentScroll ) :
          // otherwise just `true`, use the parent
          this.element.parentNode;
    
        this.parentScrollClientRect = this.options.parentScroll.getBoundingClientRect();
  
      }
};

/**
 * emits events via EvEmitter and jQuery events
 * @param {String} type - name of event
 * @param {Event} event - original event
 * @param {Array} args - extra arguments
 */
proto.dispatchEvent = function( type, event, args ) {
  var emitArgs = [ event ].concat( args );
  this.emitEvent( type, emitArgs );
  this.dispatchJQueryEvent( type, event, args );
};

proto.dispatchJQueryEvent = function( type, event, args ) {
  var jQuery = window.jQuery;
  // trigger jQuery event
  if ( !jQuery || !this.$element ) {
    return;
  }
  // create jQuery event
  var $event = jQuery.Event( event );
  $event.type = type;
  this.$element.trigger( $event, args );
};

// -------------------------- position -------------------------- //

// get x/y position from style
proto._getPosition = function() {
  var style = getComputedStyle( this.element );
  var x = this._getPositionCoord( style.left, 'width' );
  var y = this._getPositionCoord( style.top, 'height' );
  // clean up 'auto' or other non-integer values
  this.position.x = isNaN( x ) ? 0 : x;
  this.position.y = isNaN( y ) ? 0 : y;

  this._addTransformPosition( style );
};

proto._getPositionCoord = function( styleSide, measure ) {
  if ( styleSide.indexOf('%') != -1 ) {
    // convert percent into pixel for Safari, #75
    var parentSize = getSize( this.element.parentNode );
    // prevent not-in-DOM element throwing bug, #131
    return !parentSize ? 0 :
      ( parseFloat( styleSide ) / 100 ) * parentSize[ measure ];
  }
  return parseInt( styleSide, 10 );
};

// add transform: translate( x, y ) to position
proto._addTransformPosition = function( style ) {
  var transform = style.transform;
  // bail out if value is 'none'
  if ( transform.indexOf('matrix') !== 0 ) {
    return;
  }
  // split matrix(1, 0, 0, 1, x, y)
  var matrixValues = transform.split(',');
  // translate X value is in 12th or 4th position
  var xIndex = transform.indexOf('matrix3d') === 0 ? 12 : 4;
  var translateX = parseInt( matrixValues[ xIndex ], 10 );
  // translate Y value is in 13th or 5th position
  var translateY = parseInt( matrixValues[ xIndex + 1 ], 10 );
  this.position.x += translateX;
  this.position.y += translateY;
};

// -------------------------- events -------------------------- //

proto.onPointerDown = function( event, pointer ) {
  this.element.classList.add('is-pointer-down');
  this.dispatchJQueryEvent( 'pointerDown', event, [ pointer ] );
};

/**
 * drag start
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
proto.dragStart = function( event, pointer ) {
  if ( !this.isEnabled ) {
    return;
  }
  this._getPosition();
  this.measureContainment();
  this.scrollOffset = this.measureScrollOffset();
  // position _when_ drag began
  this.startPosition.x = this.position.x;
  this.startPosition.y = this.position.y;
  // reset left/top style
  this.setLeftTop();

  this.dragPoint.x = 0;
  this.dragPoint.y = 0;

  this.lastKnownMoveVector = {
        x: 0,
        y: 0
      };

  this.element.classList.add('is-dragging');
  this.dispatchEvent( 'dragStart', event, [ pointer ] );
  this.isDragging = true;

  this.options.parentScroll.addEventListener('scroll', this, false);

  // start animation
  this.animate();
};

proto.measureScrollOffset = function() {
    if ( !this.options.parentScroll ) {
      return;
    }
  
    // use element if element
    this.options.parentScroll = isElement( this.options.parentScroll ) ? this.options.parentScroll :
      // fallback to querySelector if string
      typeof this.options.parentScroll == 'string' ? document.querySelector( this.options.parentScroll ) :
      // otherwise just `true`, use the parent
      this.options.parentScroll = this.element.parentNode;
  
    return {
      top: this.options.parentScroll.scrollTop,
      left: this.options.parentScroll.scrollLeft
    };
  
  
  };
  

proto.measureContainment = function() {
  var container = this.getContainer();
  if ( !container ) {
    return;
  }

  var elemSize = getSize( this.element );
  var containerSize = getSize( container );
  var elemRect = this.element.getBoundingClientRect();
  var containerRect = container.getBoundingClientRect();

  var borderSizeX = containerSize.borderLeftWidth + containerSize.borderRightWidth;
  var borderSizeY = containerSize.borderTopWidth + containerSize.borderBottomWidth;

  var position = this.relativeStartPosition = {
    x: elemRect.left - ( containerRect.left + containerSize.borderLeftWidth ),
    y: elemRect.top - ( containerRect.top + containerSize.borderTopWidth )
  };

  this.containSize = {
    width: ( containerSize.width - borderSizeX ) - position.x - elemSize.width,
    height: ( containerSize.height - borderSizeY ) - position.y - elemSize.height
  };
};

proto.getContainer = function() {
  var containment = this.options.containment;
  if ( !containment ) {
    return;
  }
  var isElement = containment instanceof HTMLElement;
  // use as element
  if ( isElement ) {
    return containment;
  }
  // querySelector if string
  if ( typeof containment == 'string' ) {
    return document.querySelector( containment );
  }
  // fallback to parent element
  return this.element.parentNode;
};

// ----- move event ----- //

proto.onPointerMove = function( event, pointer, moveVector ) {
  this.dispatchJQueryEvent( 'pointerMove', event, [ pointer, moveVector ] );
};

/**
 * drag move
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
proto.dragMove = function( event, pointer, moveVector ) {
  if ( !this.isEnabled ) {
    return;
  }

  if (isNaN(moveVector.x) || isNaN(moveVector.y)) {
        moveVector = this.lastKnownMoveVector;
      } else {
        this.lastKnownMoveVector = moveVector;
      }
    
      this.checkAutoScroll(pointer);

  var dragX = moveVector.x;
  var dragY = moveVector.y;

  var grid = this.options.grid;
  var gridX = grid && grid[0];
  var gridY = grid && grid[1];

  dragX = this.applyScrollOffset('x', dragX);
  dragY = this.applyScrollOffset('y', dragY);

  dragX = applyGrid( dragX, gridX );
  dragY = applyGrid( dragY, gridY );

  dragX = this.containDrag( 'x', dragX, gridX );
  dragY = this.containDrag( 'y', dragY, gridY );

  // constrain to axis
  dragX = this.options.axis == 'y' ? 0 : dragX;
  dragY = this.options.axis == 'x' ? 0 : dragY;

  this.position.x = this.startPosition.x + dragX;
  this.position.y = this.startPosition.y + dragY;

  if (this.options.scale) {
        dragX = dragX / this.options.scale;
        dragY = dragY / this.options.scale;
     }

  // set dragPoint properties
  this.dragPoint.x = dragX;
  this.dragPoint.y = dragY;

  this.lastMoveEvent = event;
  this.lastPointer = pointer;
  this.lastMoveVector = moveVector;

  this.dispatchEvent( 'dragMove', event, [ pointer, moveVector ] );
};

proto.checkAutoScroll = function(pointer) {
   if (this.options.parentScroll && this.options.autoScroll ) {
    
     var scrollerRect = this.parentScrollClientRect;
     
     if ((pointer.clientY - this.options.autoScrollThreshold) <= (scrollerRect.top)) {
       this.autoScrollYDirection = -1;
      } else if ((pointer.clientY + this.options.autoScrollThreshold) >= (scrollerRect.top + scrollerRect.height)) {
        this.autoScrollYDirection = 1;
      } else {
       this.autoScrollYDirection = 0;
      }

      var viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      
      if (pointer.clientX <= this.options.autoScrollThreshold) {
        this.autoScrollXDirection = -1;
      } else if (pointer.clientX >= (Math.min(viewportWidth, scrollerRect.width) - this.options.autoScrollThreshold)) {
        this.autoScrollXDirection = 1;
      } else {
        this.autoScrollXDirection = 0;
      }

    } else {
      this.autoScrollYDirection = 0;
      this.autoScrollXDirection = 0;
    }
  };
  
  proto.onscroll = function() {
    
    if (!this.isDragging ) {      
      return;
    }

    if (this.lastMoveEvent || this.lastPointer || this.lastMoveVector) {      
      this.dragMove(this.lastMoveEvent, this.lastPointer, this.lastMoveVector);
    }
  };
  
  proto.applyScrollOffset = function( axis, value ) {

    if ( !this.options.parentScroll ) {
      return value;
    }
  
    var measure = axis == 'x' ? 'left' : 'top';
    var scrollOffset = this.measureScrollOffset();    
    return value + (scrollOffset[measure] - this.scrollOffset[measure]);
  };

function applyGrid( value, grid, method ) {
  method = method || 'round';
  return grid ? Math[ method ]( value / grid ) * grid : value;
}

proto.containDrag = function( axis, drag, grid ) {
  if ( !this.options.containment ) {
    return drag;
  }
  var measure = axis == 'x' ? 'width' : 'height';

  var rel = this.relativeStartPosition[ axis ];
  var min = applyGrid( -rel, grid, 'ceil' );
  var max = this.containSize[ measure ];
  max = applyGrid( max, grid, 'floor' );
  return  Math.max( min, Math.min( max, drag ) );
};

// ----- end event ----- //

/**
 * pointer up
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
proto.onPointerUp = function( event, pointer ) {
  this.element.classList.remove('is-pointer-down');
  this.dispatchJQueryEvent( 'pointerUp', event, [ pointer ] );
};

/**
 * drag end
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
proto.dragEnd = function( event, pointer ) {
  if ( !this.isEnabled ) {
    return;
  }
  // use top left position when complete
  this.element.style.transform = '';
  this.setLeftTop();
  this.element.classList.remove('is-dragging');
  this.dispatchEvent( 'dragEnd', event, [ pointer ] );
  this.options.parentScroll.removeEventListener('scroll', this, false);
  this.isDragging = false;
};

// -------------------------- animation -------------------------- //

proto.animate = function() {
  // only render and animate if dragging
  if ( !this.isDragging ) {
    return;
  }

  this.performAutoScroll();
  this.positionDrag();

  var _this = this;
  requestAnimationFrame( function animateFrame() {
    _this.animate();
  });

};

// left/top positioning
proto.setLeftTop = function() {
  this.element.style.left = this.position.x + 'px';
  this.element.style.top  = this.position.y + 'px';
};

proto.setScale = function(scale){
    this.options.scale = scale;
  };
  
  proto.getScale = function(){
    return this.options.scale;
  };
  
  proto.performAutoScroll = function(){
   


    if (this.autoScrollYDirection === 1 || this.autoScrollYDirection === -1) {      
        this.options.parentScroll.scrollTop = this.options.parentScroll.scrollTop + (this.options.scrollSpeed * this.autoScrollYDirection);
    }

    if (this.autoScrollXDirection === 1 || this.autoScrollXDirection === -1) {
      this.options.parentScroll.scrollLeft = this.options.parentScroll.scrollLeft + (this.options.scrollSpeed * this.autoScrollXDirection);      
    }

  };

proto.positionDrag = function() {
  this.element.style.transform = 'translate3d( ' + this.dragPoint.x +
    'px, ' + this.dragPoint.y + 'px, 0)';
};

// ----- staticClick ----- //

proto.staticClick = function( event, pointer ) {
  this.dispatchEvent( 'staticClick', event, [ pointer ] );
};

// ----- methods ----- //

/**
 * @param {Number} x
 * @param {Number} y
 */
proto.setPosition = function( x, y ) {
  this.position.x = x;
  this.position.y = y;
  this.setLeftTop();
};

proto.enable = function() {
  this.isEnabled = true;
};

proto.disable = function() {
  this.isEnabled = false;
  if ( this.isDragging ) {
    this.dragEnd();
  }
};

proto.destroy = function() {
  this.disable();
  // reset styles
  this.element.style.transform = '';
  this.element.style.left = '';
  this.element.style.top = '';
  this.element.style.position = '';
  // unbind handles
  this.unbindHandles();
   //removing an extra event listener for scrolling
 if ( this.options.parentScroll ) {
  
     this.options.parentScroll = isElement( this.options.parentScroll ) ? this.options.parentScroll :
        // fallback to querySelector if string
        typeof this.options.parentScroll == 'string' ? document.querySelector( this.options.parentScroll ) :
        // otherwise just `true`, use the parent
        this.element.parentNode;
  
   }
  // remove jQuery data
  if ( this.$element ) {
    this.$element.removeData('draggabilly');
  }
};

// ----- jQuery bridget ----- //

// required for jQuery bridget
proto._init = noop;

if ( jQuery && jQuery.bridget ) {
  jQuery.bridget( 'draggabilly', Draggabilly );
}

// -----  ----- //

return Draggabilly;

}));
