//--------------------------------------------------------------
//Global Variable
//--------------------------------------------------------------
let IMAGES_LOADED = false;
const IMAGE_MAP = new Map();
const SOUND_MAP = new Map();

const KEYS = new Map();
const TOUCHES = new Map();
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 650;
const GRAVITY=0.7;

const DRAW_OBJECTS = [];
const UPDATE_OBJECTS = [];
const COLLISION_OBJECTS = [];

let PLAYER = null;
let CAMERA = null;
const PLAYER_INDEX = 10;


//easing functions
//(t => t * t); // Ease-in (slow start)

function powerEasingIn(pow,t){return Math.pow(t,pow);}

//Linear
function linearEasing(t){return t;}

// // Ease-out
function pow2Easing(t){
    return 1 - Math.pow(1 - t, 2);
}

// Ease-out
function expEasing(pow,t){
    return 1 - Math.exp(-1 * pow * t);
}

function getImage(imageId){
    if(IMAGES_LOADED){
        const image = IMAGE_MAP.get(imageId);
        if (!image){console.warn(`Image not found for sprite: ${imageId}`);}
        return image;
    }
    console.warn(`Images not loaded yet`);
    return null;
}

//--------------------------------------------------------------
// Vector Class
//--------------------------------------------------------------
class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(value,y) {
        if (value instanceof Vector) {
            this.x += value.x;
            this.y += value.y;
        }else{
            this.x += value;
            this.y += y;
        }
        return this;
    }

    subtract(value,y) {
        if (value instanceof Vector) {
            this.x -= value.x;
            this.y -= value.y;
        }else{
            this.x -= value;
            this.y -= y;
        }
        return this;
    }

    multiply(value,y) {
        if (value instanceof Vector) {
            this.x *= value.x;
            this.y *= value.y;
        }else{
            this.x *= value;
            this.y *= y;
        }
        return this;
    }

    divide(value,y) {
        if (value instanceof Vector) {
            this.x /= value.x;
            this.y /= value.y;
        }else{
            this.x /= value;
            this.y /= y;
        }
        return this;
    }

    set(value,y) {
        if (value instanceof Vector) {
            this.x = value.x;
            this.y = value.y;
        }else{
            this.x = value;
            this.y = y;
        }
    }

    clone() {
        return new Vector(this.x, this.y);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    length2() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    cross(other) {
        return this.x * other.y - this.y * other.x;
    }

    distanceTo(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceTo2(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return dx * dx + dy * dy;
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;
        this.x = newX;
        this.y = newY;
        return this;
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    angleTo(other) {
        return Math.atan2(this.cross(other), this.dot(other));
    }

    lerp(other, t) {
        this.x += (other.x - this.x) * t;
        this.y += (other.y - this.y) * t;
        return this;
    }

    toString() {
        return `Vector(${this.x}, ${this.y})`;
    }

    equals(other, epsilon = 0.001) {
        return (
            Math.abs(this.x - other.x) < epsilon &&
            Math.abs(this.y - other.y) < epsilon
        );
    }

    perpendicular() {
        return new Vector(-this.y, this.x);
    }

    manhattanDistance(other) {
        return Math.abs(this.x - other.x) + Math.abs(this.y - other.y);
    }
}


//--------------------------------------------------------------
//AABB class
//--------------------------------------------------------------
class AABB {
    constructor(a, b, c, d) {
        if (a instanceof Vector) {
            // Form: new AABB(position, width, height)
            this.position = a;
            this.width = b;
            this.height = c;
        } else {
            // Form: new AABB(x, y, width, height)
            this.position = new Vector(a, b);
            this.width = c;
            this.height = d;
        }
    }

    translate(vec) {
        this.position.add(vec);
    }

    intersects(other) {
        return (
            this.position.x < other.position.x + other.width &&
            this.position.x + this.width > other.position.x &&
            this.position.y < other.position.y + other.height &&
            this.position.y + this.height > other.position.y
        );
    }

    intersectsRaw(x, y, w, h) {
        return (
            this.position.x < x + w &&
            this.position.x + this.width > x &&
            this.position.y < y + h &&
            this.position.y + this.height > y
        );
    }

    contains(other) {
        return (
            this.position.x <= other.position.x &&
            this.position.x + this.width >= other.position.x + other.width &&
            this.position.y <= other.position.y &&
            this.position.y + this.height >= other.position.y + other.height
        );
    }

    // Get the minimum translation vector to resolve collision
    getCollisionResolution(other) {
        if (!this.intersects(other)) return new Vector(0, 0);

        // Calculate penetration depths on all sides
        const penLeft = (this.position.x + this.width) - other.position.x;
        const penRight = (other.position.x + other.width) - this.position.x;
        const penTop = (this.position.y + this.height) - other.position.y;
        const penBottom = (other.position.y + other.height) - this.position.y;

        // Find the minimum penetration
        const minX = Math.min(penLeft, penRight);
        const minY = Math.min(penTop, penBottom);
        const minPen = Math.min(minX, minY);

        // Create resolution vector
        const resolution = new Vector();

        if (minPen === penLeft) {
            resolution.x = -penLeft;
        } else if (minPen === penRight) {
            resolution.x = penRight;
        } else if (minPen === penTop) {
            resolution.y = -penTop;
        } else if (minPen === penBottom) {
            resolution.y = penBottom;
        }

        return resolution;
    }

    // Get the center point of the AABB
    getCenter() {
        return new Vector(
            this.position.x + this.width / 2,
            this.position.y + this.height / 2
        );
    }

    containsPoint(point) {
        return (
            point.x >= this.position.x &&
            point.x <= this.position.x + this.width &&
            point.y >= this.position.y &&
            point.y <= this.position.y + this.height
        );
    }
}


//--------------------------------------------------------------
//Pea : Main component model
//--------------------------------------------------------------
class Pea {

    constructor(position = new Vector(),zIndexDraw,zIndexCollision) {
        this.position = position;
        this.zIndexDraw = zIndexDraw;
        this.zIndexCollision = zIndexCollision;
        this.children = null;
    }

    update() {
        if (this.children) {
            for (const child of this.children) {
                child.update();
            }
        }
    }

    draw(ctx, camera) {
        if (this.children) {
            for (const child of this.children) {
                child.draw(ctx, camera);
            }
        }
    }

    add(peas) {
        if (this.children===null) this.children = [];
        if (Array.isArray(peas)) {
            this.children.push(...peas);
        } else {
            this.children.push(peas);
        }
    }

    remove(peas) {
        if (this.children) {
            if (!Array.isArray(peas)) peas = [peas];
            this.children = this.children.filter(child => !peas.includes(child));
        }
    }

    clear() {
        if (this.children) {
            this.children.length = 0;
        }
    }
}


//--------------------------------------------------------------
//Sprites
//--------------------------------------------------------------
class Sprite extends Pea {
    constructor(imageId, position = new Vector(), zIndexDraw,zIndexCollision) {
        super(position,zIndexDraw,zIndexCollision);
        this.image = getImage(imageId);
        this.position = position;
        this.width = this.image.width;
        this.height = this.image.height;
    }

    update() {}

    draw(ctx, camera){
        if (!this.image || !camera.shape.intersectsRaw(this.position.x,this.position.y,this.width,this.height)) return;
        ctx.drawImage(
            this.image,
            this.position.x - camera.position.x,
            this.position.y - camera.position.y ,
            this.width,
            this.height
        );
    }
}


class ParallaxLayer extends Sprite {
    constructor(imageId, position, zIndexDraw,zIndexCollision, speedModifierX = 1, speedModifierY = 1, repeatX = true, repeatY = true) {
        super(imageId, position, zIndexDraw,zIndexCollision);
        this.speedModifierX = speedModifierX;
        this.speedModifierY = speedModifierY;
        this.repeatX = repeatX;
        this.repeatY = repeatY;
    }

    update() {}

    draw(ctx, camera ) {
        if (!this.image || !camera) return;

        const offsetX = camera.position.x * this.speedModifierX;
        const offsetY = camera.position.y * this.speedModifierY;

        // Anchor-based parallax position
        const baseX = this.position.x - offsetX;
        const baseY = this.position.y - offsetY;

        if (!this.repeatX && !this.repeatY) {
            // No tiling at all — draw single image
            ctx.drawImage(this.image, baseX, baseY, this.width, this.height);
            return;
        }

        // Compute tiling start aligned to anchor tile
        const startX = this.repeatX
            ? baseX % this.width - this.width
            : baseX;

        const startY = this.repeatY
            ? baseY % this.height - this.height
            : baseY;

        const endX = this.repeatX ? camera.shape.width + this.width : baseX + 1;
        const endY = this.repeatY ? camera.shape.height + this.height : baseY + 1;

        for (let y = startY; y < endY; y += this.height) {
            for (let x = startX; x < endX; x += this.width) {
                ctx.drawImage(this.image, x, y, this.width, this.height);
            }
        }
    }

}


class SpriteAnimation extends Sprite {
    constructor(imageId, position, zIndexDraw,zIndexCollision, frameWidth, frameHeight, staggerFrames = 5) {
        super(imageId, position, zIndexDraw,zIndexCollision);

        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.staggerFrames = staggerFrames;

        this.states = {}; // { stateName: { frames: number, row: number } }
        this.currentState = null;
        this.currentFrame = 0;
        this.frameCounter = 0;
    }

    addState(stateName, rowCount, frameCount) {
        this.states[stateName] = {
            row: rowCount,
            frames: frameCount
        };
        if (!this.currentState) this.setState(stateName); // Default to first added
    }

    setState(stateName) {
        if (this.states[stateName]) {
            if (this.currentState !== stateName) {
                this.currentState = stateName;
                this.currentFrame = 0;
                this.frameCounter = 0;
            }
        } else {
            console.warn(`State "${stateName}" does not exist.`);
        }
    }

    update() {
        if (!this.currentState || !this.image) return;

        this.frameCounter++;
        if (this.frameCounter >= this.staggerFrames) {
            this.currentFrame = (this.currentFrame + 1) % this.states[this.currentState].frames;
            this.frameCounter = 0;
        }
    }

    draw(ctx, camera ,options= null) {
        if (!this.image || !this.currentState || !camera.shape.intersectsRaw(this.position.x,this.position.y,this.frameWidth,this.frameHeight)) return;

        const state = this.states[this.currentState];

        if (options && options.flip) {
            ctx.save();
            ctx.translate(
                this.position.x - camera.position.x + this.frameWidth,
                this.position.y - camera.position.y
            );
            ctx.scale(-1, 1);
            ctx.drawImage(
                this.image,
                this.currentFrame * this.frameWidth, // sx
                state.row * this.frameHeight, // sy
                this.frameWidth, this.frameHeight,
                0,  // drawX (now relative to the translation)
                0,  // drawY (now relative to the translation)
                this.frameWidth, this.frameHeight
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                this.image,
                this.currentFrame * this.frameWidth, // sx
                state.row * this.frameHeight, // sy
                this.frameWidth, this.frameHeight,
                this.position.x - camera.position.x,  // drawX
                this.position.y - camera.position.y, // drawY
                this.frameWidth, this.frameHeight
            );
        }


    }

}


class Banner extends Pea{
    constructor( position = new Vector(), zIndexDraw,zIndexCollision,
                 {
                     text = 'Banner',
                     font = 'Times New Roman',
                     fontSize = 20,
                     textColor = '#FFFFFF',
                     backgroundColor = '#DC2521',
                     offX = 100,
                     offY = 5,
                     staggerFrames = 0
                 } = {}) {

        super(position,zIndexDraw,zIndexCollision);
        this.text = text;
        this.font = font;
        this.fontSize = fontSize;
        this.textColor = textColor;
        this.backgroundColor = backgroundColor;
        this.offX = offX;
        this.offY = offY;

        this.width = 0;
        this.height = 0;
        this.updateWidthHeight();

        this.staggerFrames = staggerFrames;
        this.frameCounter = 0;
        this.visible = true;
    }

    updateWidthHeight() {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = `${this.fontSize}px ${this.font}`;

        this.width = tempCtx.measureText(this.text).width + this.offX * 2;
        this.height = this.fontSize + this.offY * 2;
    }


    update() {
        if (this.staggerFrames > 0) {
            this.frameCounter++;
            if (this.frameCounter >= this.staggerFrames) {
                this.visible = !this.visible;
                this.frameCounter = 0;
            }
        }
    }

    draw(ctx, camera) {
        if (!this.visible || !camera.shape.intersectsRaw(this.position.x,this.position.y,this.width,this.height)) return;

        ctx.save();

        if (this.backgroundColor) {
            ctx.fillStyle = this.backgroundColor;
            ctx.fillRect(this.position.x - camera.position.x, this.position.y - camera.position.y, this.width, this.height);
        }

        ctx.fillStyle = this.textColor;
        ctx.font = `${this.fontSize}px ${this.font}`;
        ctx.textBaseline = 'top';
        ctx.fillText(this.text, this.position.x + this.offX - camera.position.x, this.position.y + this.offY - camera.position.y);

        ctx.restore();
    }
}


class Banner2 extends Pea {
    constructor(
        position = new Vector(),
        zIndexDraw,
        zIndexCollision,
        {
            job = 'Senior Game Developer',
            duration = '2018 – Present',
            description = 'Led the design and development of high-performance 2D/3D game engines across multiple platforms.',
            fontJob = 'Impact',
            fontDuration = 'Courier New',
            fontDescription = 'Garamond',
            fontSizeJob = 28,
            fontSizeDuration = 20,
            fontSizeDescription = 16,
            textColor = '#FFFFFF',
            backgroundColor = '#000000',
            width = 435,
            height = 180,
            padding = 20
        } = {}
    ) {
        super(position, zIndexDraw, zIndexCollision);

        this.job = job;
        this.duration = duration;
        this.description = description;

        this.fontJob = fontJob;
        this.fontDuration = fontDuration;
        this.fontDescription = fontDescription;

        this.fontSizeJob = fontSizeJob;
        this.fontSizeDuration = fontSizeDuration;
        this.fontSizeDescription = fontSizeDescription;

        this.textColor = textColor;
        this.backgroundColor = backgroundColor;

        this.width = width;
        this.height = height;
        this.padding = padding;

        this.visible = true;
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }

    update() {
        // Can add animation or visibility logic here if needed
    }

    draw(ctx, camera) {
        if (!this.visible || !camera.shape.intersectsRaw(this.position.x, this.position.y, this.width, this.height)) return;

        const drawX = this.position.x - camera.position.x;
        const drawY = this.position.y - camera.position.y;

        ctx.save();

        // Draw background
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(drawX, drawY, this.width, this.height);

        ctx.strokeStyle = '#888888'; // or any grey color
        ctx.lineWidth = 5; // optional: thickness of the border
        ctx.strokeRect(drawX, drawY, this.width, this.height);

        ctx.fillStyle = this.textColor;

        // === Job Title ===
        ctx.font = `${this.fontSizeJob}px ${this.fontJob}`;
        ctx.textBaseline = 'top';
        ctx.fillText(this.job, drawX + this.padding, drawY + this.padding);

        // === Duration ===
        const durationY = drawY + this.padding + this.fontSizeJob + 8;
        ctx.font = `${this.fontSizeDuration}px ${this.fontDuration}`;
        ctx.fillText(this.duration, drawX + this.padding, durationY);

        // === Description ===
        const descriptionY = durationY + this.fontSizeDuration + 12;
        ctx.font = `${this.fontSizeDescription}px ${this.fontDescription}`;
        this.wrapText(ctx, this.description, drawX + this.padding, descriptionY, this.width - this.padding * 2, this.fontSizeDescription + 6);

        ctx.restore();
    }
}


//--------------------------------------------------------------
//Player class
//--------------------------------------------------------------
class Player {
    constructor() {
        this.position = new Vector(10, 400);
        this.shape = new AABB(this.position.clone().add(30,15), 65, 160);
        this.cameraTarget = this.shape.getCenter().add(100,0);
        this.zIndexDraw = PLAYER_INDEX;
        this.zIndexCollision = PLAYER_INDEX;
        this.velocity = new Vector(0, 0);

        //sprite
        this.sprite = new SpriteAnimation("sprite", this.position, this.zIndexDraw,this.zIndexDraw, 110, 175, 8);
        this.sprite.addState("idle", 0, 4);
        this.sprite.addState("running", 1, 4);
        this.sprite.addState("jumping", 2, 4);
        this.sprite.addState("falling", 3, 4);
        this.sprite.setState("idle");

        //other
        this.facingRight = true;
        this.maxRunningVelocity = 15;

        this.onGround = false;
        this.maxFallVelocity = 30;

        //jump
        this.jumpTimer = 0;
        this.isJumping = false;
        this.maxJumpTime = 20; // frames or ticks
        this.jumpSpeed = -10; // initial jump impulse per frame
    }

    draw(ctx, camera ) {
        this.sprite.update();
        this.sprite.draw(ctx, camera,{flip:!this.facingRight});
    }

    translate(vector){
        this.position.add(vector);
        this.shape.translate(vector);
        this.cameraTarget.add(vector);
    }


    update() {
        const keysPressed = {
            left: KEYS.get('ArrowLeft') || TOUCHES.get('left'),
            right: KEYS.get('ArrowRight') || TOUCHES.get('right'),
            jump: KEYS.get('ArrowUp') || TOUCHES.get('up'),
        };

        // ----------------
        // Horizontal movement
        // ----------------
        if (keysPressed.right && !keysPressed.left) {
            this.facingRight = true;
            this.velocity.x += 1;
            if (this.velocity.x > this.maxRunningVelocity) this.velocity.x = this.maxRunningVelocity;
        } else if (keysPressed.left && !keysPressed.right) {
            this.facingRight = false;
            this.velocity.x -= 1;
            if (this.velocity.x < -this.maxRunningVelocity) this.velocity.x = -this.maxRunningVelocity;
        } else {
            this.velocity.x *= 0.4;
            if (Math.abs(this.velocity.x) < 0.2) this.velocity.x = 0;
        }

        // ----------------
        // Variable Jumping
        // ----------------
        if (keysPressed.jump) {
            if (this.onGround) {
                // Start jump
                this.isJumping = true;
                this.jumpTimer = 0;
                this.onGround = false;

                const jumpSound = SOUND_MAP.get('jump');
                //jumpSound.currentTime = 0;
                jumpSound.play();
            }

            if (this.isJumping && this.jumpTimer < this.maxJumpTime) {
                this.velocity.y = this.jumpSpeed;
                this.jumpTimer++;
            }
        } else {
            // Jump key released early
            this.isJumping = false;
        }

        // ----------------
        // Gravity
        // ----------------
        this.velocity.y += GRAVITY;
        if (this.velocity.y > this.maxFallVelocity) this.velocity.y = this.maxFallVelocity;

        // ----------------
        // Apply Velocity
        // ----------------
        this.translate(this.velocity);

        // ----------------
        // Collision Resolution + Ground Check
        // ----------------
        this.onGround = false;


        for (const object of COLLISION_OBJECTS) {
            if (object.zIndexCollision === this.zIndexCollision) {
                const resolution = this.shape.getCollisionResolution(object.shape);
                if (resolution) {
                    this.translate(resolution);

                    // Ground detection
                    if (resolution.y < 0) {
                        this.onGround = true;
                        this.velocity.y = 0;
                        this.isJumping = false;
                    }else if (resolution.y > 0){
                        this.jumpTimer = this.maxJumpTime;
                        this.velocity.y = 0;
                    }

                    // Optional: stop horizontal velocity on side collisions
                    if (resolution.x !== 0) {
                        this.velocity.x = 0;
                    }
                }
            }
        }


        const state = this.determineState();
        const footstepsSound = SOUND_MAP.get('footsteps');
        if (state === 'running') {
            if (footstepsSound.paused) {
                footstepsSound.currentTime = 0;
                footstepsSound.play();
            }
        } else {
            if (!footstepsSound.paused) { // only stop if currently playing
                footstepsSound.pause();
                footstepsSound.currentTime = 0;
            }
        }

    }


    determineState() {
        if (!this.sprite) return '';

        if (!this.onGround) {
            if (this.velocity.y < 0) {
                this.sprite.setState("jumping");
                return 'jumping';
            } else {
                this.sprite.setState("falling");
                return 'falling';
            }
        } else if (Math.abs(this.velocity.x) > 0.4) {
            this.sprite.setState("running");
            return 'running';
        } else {
            this.sprite.setState("idle");
            return 'idle';
        }
    }




}


//--------------------------------------------------------------
//Camera
//--------------------------------------------------------------
class Camera {
    constructor() {
        this.position = new Vector(0,0);
        this.shape = new AABB(this.position,CANVAS_WIDTH, CANVAS_HEIGHT);

        this.target = null;
        this.followSpeedX = 0.1; // 0 = no follow, 1 = instant snap
        this.followSpeedY = 0.1; // 0 = no follow, 1 = instant snap
        this.easingFunctionX = linearEasing; // Default: linear easing
        this.easingFunctionY = linearEasing; // Default: linear easing
        this.followX = true;
        this.followY = true;
        this.bounds = null; //{minX:-10000,minY:-10000,maxX:10000,maxY:10000};
    }

    setTarget(target){this.target = target;}
    setBounds(bounds) {this.bounds = bounds;}

    shake(){
        this.position.add( Math.floor(Math.random()*15)-7,0);
        //this.y +=  (Math.floor(Math.random()*3)-1)/2;
    }

    update() {
        if (!this.target) return;
        const targetX = this.target.x - this.shape.width / 2;
        const targetY = this.target.y - this.shape.height / 2;
        const easeX = this.easingFunctionX(this.followSpeedX);
        const easeY = this.easingFunctionY(this.followSpeedY);

        if (this.followX) {
            this.position.x += (targetX - this.position.x) * easeX;
        }
        if (this.followY) {
            this.position.y += (targetY - this.position.y) * easeY;
        }

            if (this.bounds) {
                this.position.set(
                    Math.max(this.bounds.minX, Math.min(this.bounds.maxX - this.shape.width, this.shape.position.x)),
                    Math.max(this.bounds.minY, Math.min(this.bounds.maxY - this.shape.height, this.shape.position.y))
                );
            }
    }


}



//--------------------------------------------------------------
//obj class
//--------------------------------------------------------------


class StaticObject extends Pea{
    constructor(position, zIndexDraw,zIndexCollision,shape = null) {
        super(position, zIndexDraw,zIndexCollision);
        this.shape = shape;
    }

    setShape(shape){this.shape=shape;}

    intersectsWithCamera(camera) {
        if (this.shape){
            return this.shape.intersects(camera.shape);
        }
        return false;
    }
}

class MovingObject extends StaticObject{
    constructor(startPosition, endPosition, zIndexDraw,zIndexCollision , shape = null, oscillate = false) {
        super(startPosition.clone(),zIndexDraw,zIndexCollision,shape);
        this.startPosition = startPosition;
        this.endPosition = endPosition;

        this.oscillate = oscillate;
        this.easingFunction = (t) => t;
        this.duration = 1.5;
        this.time = 0;
        this.forward = true;

        this.active = false;
    }

    setActive(active){
        this.active = active;
    }

    setEasing(fn) {
        this.easingFunction = fn;
    }

    setDuration(duration){
        this.duration = duration;
    }

    shouldActivate() {
        // Default condition: always activate
        return true;
    }

    isDone(){
        return !this.oscillate && this.time >= this.duration;
    }

    update() {

        if (!this.active) {
            if (this.isDone()) return;
            if (this.shouldActivate()) {
                this.setActive(true);
            } else {
                return;
            }
        }


        const delta = 1 / 60; // assuming 60 FPS
        this.time += delta;

        let t = this.time / this.duration;

        if (t >= 1) {
            if (this.oscillate) {
                this.forward = !this.forward;
                this.time = 0;
                t = 0;
            } else {
                t = 1;
                this.setActive(false);
            }
        }

        const ease = this.easingFunction(t);

        const from = this.forward ? this.startPosition : this.endPosition;
        const to = this.forward ? this.endPosition : this.startPosition;

        this.position.set(from.x + (to.x - from.x) * ease, from.y + (to.y - from.y) * ease);
        super.update();
    }

}

class TriggerZone extends StaticObject{
    constructor(position, zIndexDraw,zIndexCollision,shape) {
        super(position, zIndexDraw,zIndexCollision,shape);
    }

    trigger(){
        return true;
    };

    triggerFunction(){
        return;
    }

    update() {
        if (this.trigger()){
            this.triggerFunction();
        }
        super.update();
    }

}



//--------------------------------------------------------------
//--------------------------------------------------------------
//--------------------------------------------------------------
function removeLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    if (screen) {
        screen.style.opacity = '0';
        setTimeout(() => screen.remove(), 400);
    }
}

function setUpControls(){
    console.log('setting up controls ...');
    window.addEventListener('keydown', (event) => {
        KEYS.set(event.key, true);
    });
    window.addEventListener('keyup', (event) => {
        KEYS.set(event.key, false);
    });
}

function setupTouchControls() {
    const leftZone = document.getElementById('touch-left');
    const rightZone = document.getElementById('touch-right');
    const jumpZone = document.getElementById('touch-jump');

    function activate(zone, key) {
        zone.classList.add('active');
        TOUCHES.set(key,true);
    }
    function deactivate(zone, key) {
        zone.classList.remove('active');
        TOUCHES.set(key,false);
    }

    // Left zone controls left/right movement by dividing it in half horizontally
    leftZone.addEventListener('touchstart', e => activate(leftZone, 'left'));
    leftZone.addEventListener('touchend', e => deactivate(leftZone, 'left') );
    leftZone.addEventListener('touchcancel', e => deactivate(leftZone, 'left'));

    rightZone.addEventListener('touchstart', e => activate(rightZone, 'right'));
    rightZone.addEventListener('touchend', e => deactivate(rightZone, 'right'));
    rightZone.addEventListener('touchcancel', e => deactivate(rightZone, 'right'));

    // Right zone controls jump
    jumpZone.addEventListener('touchstart', e => activate(jumpZone, 'up'));
    jumpZone.addEventListener('touchend', e => deactivate(jumpZone, 'up'));
    jumpZone.addEventListener('touchcancel', e => deactivate(jumpZone, 'up'));
}

function loadSounds() {
    console.log("loading sounds ...");
    return new Promise((resolve) => {
        const container = document.getElementById('sounds');
        if (!container) {
            console.warn(`Container with ID "sounds" not found.`);
            resolve();
            return;
        }

        const songs = container.querySelectorAll('audio[id]');
        const totalSongs = songs.length;
        if (totalSongs === 0) {
            resolve();
            return;
        }

        let loadedCount = 0;

        const checkAllLoaded = () => {
            loadedCount++;
            if (loadedCount === totalSongs) {
                resolve();
            }
        };

        songs.forEach(audio => {
            const id = audio.id;
            SOUND_MAP.set(id, audio);

            // If metadata is already loaded
            if (audio.readyState >= 4) { // HAVE_ENOUGH_DATA
                checkAllLoaded();
            } else {
                audio.addEventListener('canplaythrough', checkAllLoaded, { once: true });
                audio.addEventListener('error', () => {
                    console.warn(`Failed to load audio with ID "${id}"`);
                    checkAllLoaded();
                }, { once: true });
            }
        });
    });
}

function loadImages() {
    console.log('loading images ...');
    return new Promise((resolve) => {
        const container = document.getElementById('images');
        if (!container) {
            console.warn(`Container with ID "images" not found.`);
            resolve(); // Resolve anyway, so buildWorld can continue
            return;
        }

        const images = container.querySelectorAll('img[id]');
        const totalImages = images.length;
        if (totalImages === 0) {
            IMAGES_LOADED = true;
            resolve();
            return;
        }

        let loadedCount = 0;

        const checkAllLoaded = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
                IMAGES_LOADED = true;
                resolve();
            }
        };

        images.forEach(img => {
            const id = img.id;
            IMAGE_MAP.set(id, img);

            if (img.complete && img.naturalWidth !== 0) {
                // Already loaded
                checkAllLoaded();
            } else {
                img.addEventListener('load', checkAllLoaded,{ once: true });
                img.addEventListener('error', () => {
                    console.warn(`Failed to load image with ID "${id}"`);
                    checkAllLoaded();
                },{ once: true });
            }
        });
    });
}

function buildArrows(){

    const delta = 80;

    const arrows = ['left','down','right','up'];
    const endPos = [new Vector(200 ,900),new Vector(200 + delta,900 ),new Vector(200 + 2 * delta,900 ),new Vector(200 + delta,900 - delta)];
    const startPos = [new Vector(2000 ,600),new Vector(3000 + delta,900 ),new Vector(4000,700 ),new Vector(3000 ,400)];
    const duration =[2,2.5,3,2];
    for (let i = 0; i < arrows.length;i++){
        const ar = new MovingObject(
            startPos[i],
            endPos[i],
            PLAYER_INDEX,PLAYER_INDEX, null, false);
        ar.setShape(new AABB(ar.position,64,64));
        const arSprite = new Sprite(arrows[i],ar.position,PLAYER_INDEX+1,PLAYER_INDEX+1);
        ar.add(arSprite);

        ar.setEasing(t => expEasing(6,t));
        ar.setDuration(duration[i]);

        DRAW_OBJECTS.push(arSprite);
        UPDATE_OBJECTS.push(ar);
        COLLISION_OBJECTS.push(ar);
    }
}

function buildWorld(){
    console.log('building world ...');

    PLAYER = new Player();
    CAMERA = new Camera();
    CAMERA.setTarget(PLAYER.cameraTarget);
    CAMERA.setBounds({minX:-100,minY:410,maxX:12000,maxY:1130});

    const layer0 = new ParallaxLayer("layer0",new Vector(0,-200),0,0,0.1,0.1,true,false);
    const layer1 = new ParallaxLayer("layer1",new Vector(0,390),1,1,0.2,0.2,true,false);
    const layer2 = new ParallaxLayer("layer2",new Vector(0,510),2,2,0.3,0.3,true,false);
    const layer3 = new ParallaxLayer("layer3",new Vector(0,1000),PLAYER_INDEX+5,PLAYER_INDEX+5,1,1,true,false);
    DRAW_OBJECTS.push(layer0);
    DRAW_OBJECTS.push(layer1);
    DRAW_OBJECTS.push(layer2);
    DRAW_OBJECTS.push(layer3);



    const ground = new StaticObject(new Vector(-1000,1000),PLAYER_INDEX+1,PLAYER_INDEX,null);
    ground.setShape(new AABB(ground.position,50000,500));
    COLLISION_OBJECTS.push(ground);


    const leftLimiter = new StaticObject(new Vector(-250,0),PLAYER_INDEX+1,PLAYER_INDEX,null);
    leftLimiter.setShape(new AABB(leftLimiter.position,100,1500));
    COLLISION_OBJECTS.push(leftLimiter);

    const rightLimiter = new StaticObject(new Vector(12000,0),PLAYER_INDEX+1,PLAYER_INDEX,null);
    rightLimiter.setShape(new AABB(rightLimiter.position,100,1500));
    COLLISION_OBJECTS.push(rightLimiter);

    //build arrows
    buildArrows();

    //building Door
    const porte = new StaticObject(new Vector(700,664),PLAYER_INDEX,PLAYER_INDEX,null);
    porte.setShape(new AABB(porte.position.clone().add(107,35)  ,47,90));
    const portSprite1 = new Sprite('porte01',porte.position,PLAYER_INDEX-1,PLAYER_INDEX-1);
    const portSprite2 = new Sprite('porte02',porte.position.clone().add(130,0),PLAYER_INDEX+1,PLAYER_INDEX+1);
    porte.add(portSprite1);
    porte.add(portSprite2);
    COLLISION_OBJECTS.push(porte);
    DRAW_OBJECTS.push(portSprite1);
    DRAW_OBJECTS.push(portSprite2);


    //building Arc
    const arc = new MovingObject(new Vector(1500,1000), new Vector(1500,800), PLAYER_INDEX+1, PLAYER_INDEX+1);
    const arcSprite = new Sprite('arc',arc.position,PLAYER_INDEX+1, PLAYER_INDEX+1);
    arc.add(arcSprite);
    arc.shouldActivate = function() {
        return arc.endPosition.manhattanDistance(PLAYER.position) < 500;
    };
    arc.setDuration(0.5);
    arc.setEasing(pow2Easing);
    UPDATE_OBJECTS.push(arc);
    DRAW_OBJECTS.push(arcSprite);


    //building Eiffel

    const eiffel = new MovingObject(new Vector(1710,1000), new Vector(1710,650), PLAYER_INDEX-1, PLAYER_INDEX-1);
    const eiffelSprite = new Sprite('eiffel',eiffel.position,PLAYER_INDEX-1, PLAYER_INDEX-1);
    eiffel.add(eiffelSprite);
    eiffel.setDuration(0.5);
    eiffel.setEasing(pow2Easing);
    eiffel.shouldActivate = function() {
        return arc.isDone()  ;
    };
    UPDATE_OBJECTS.push(eiffel);
    DRAW_OBJECTS.push(eiffelSprite);

    //notre dame
    const notre_dame = new MovingObject(new Vector(1855,1000), new Vector(1855,750), PLAYER_INDEX-1, PLAYER_INDEX-1);
    const notre_dameSprite = new Sprite('notre_dame',notre_dame.position,PLAYER_INDEX-1, PLAYER_INDEX-1);
    notre_dame.add(notre_dameSprite);
    notre_dame.setDuration(0.5);
    notre_dame.setEasing(pow2Easing);
    notre_dame.shouldActivate = function() {
        return eiffel.isDone()  ;
    };
    UPDATE_OBJECTS.push(notre_dame);
    DRAW_OBJECTS.push(notre_dameSprite);




    //building Polytech
    const polytech = new MovingObject(new Vector(2500,1000), new Vector(2500,520), PLAYER_INDEX-1, PLAYER_INDEX-1);
    const polytechSprite = new Sprite('polytech_building',polytech.position,PLAYER_INDEX-1, PLAYER_INDEX-1);
    polytech.add(polytechSprite);
    polytech.shouldActivate = function() {
        return polytech.endPosition.manhattanDistance(PLAYER.position) < 400;
    };
    polytech.setDuration(4);
    polytech.setEasing(pow2Easing);
    UPDATE_OBJECTS.push(polytech);
    DRAW_OBJECTS.push(polytechSprite);

    const guitar_player = new Sprite('guitar_player',new Vector(3900,851),PLAYER_INDEX-3, PLAYER_INDEX-3);
    DRAW_OBJECTS.push(guitar_player);
    const music_animation = new SpriteAnimation('music_animation', new Vector(4050,751), PLAYER_INDEX-1,PLAYER_INDEX-1, 100, 100,  6);
    music_animation.addState("animation", 0, 4);
    music_animation.setState("animation");
    UPDATE_OBJECTS.push(music_animation);
    DRAW_OBJECTS.push(music_animation);



    //building banners
    const banner0 = new Banner( new Vector(90,600),PLAYER_INDEX-2,PLAYER_INDEX-2,
        {
        text: 'Press arrows to scroll through my resume',
        textColor : '#000000',
        fontSize: 28,
        backgroundColor: null,
        offX:20,
        offY:10,
        staggerFrames: 40
    });

    UPDATE_OBJECTS.push(banner0);
    DRAW_OBJECTS.push(banner0);



    const bannerParis = new Banner( new Vector(1590,530),PLAYER_INDEX-2,PLAYER_INDEX-2,
        {
            text: 'Live and study in Paris',
        });

    DRAW_OBJECTS.push(bannerParis);



    const bannerStudy = new Banner( new Vector(2800,530),PLAYER_INDEX-2,PLAYER_INDEX-2,
        {
            text: 'Software Engineering Student At Polytech Paris Saclay',
        });
    DRAW_OBJECTS.push(bannerStudy);


    const bannerMusic = new Banner( new Vector(3870,530),PLAYER_INDEX-2,PLAYER_INDEX-2,
        {
            text: 'Guitar player',
        });
    DRAW_OBJECTS.push(bannerMusic);


    //shaking camera
    const trigger1 = new TriggerZone(new Vector(2100,500),PLAYER_INDEX,PLAYER_INDEX,null,null);
    trigger1.setShape(new AABB(trigger1.position,1500,1000));
    const es = SOUND_MAP.get('earthquake');
    trigger1.trigger = function () {
        if (polytech.active && PLAYER.shape.intersects(this.shape)){
            es.volume = 1;
            if (es.paused) es.play();
            return true;
        }else{
            es.volume = 0;
            return false;
        }
    };
    trigger1.triggerFunction = function () {
        CAMERA.shake();
    };
    UPDATE_OBJECTS.push(trigger1);



    const trigger2 = new TriggerZone(new Vector(3900,500),PLAYER_INDEX,PLAYER_INDEX,null,null);
    trigger2.setShape(new AABB(trigger2.position,200,700));
    const gs = SOUND_MAP.get('hello');
    let playerIn = false;
    trigger2.trigger = function () {
        if (PLAYER.shape.intersects(this.shape)){
            if (!playerIn && gs.paused) gs.play();
            playerIn = true;
            return true;
        }else{
            playerIn = false;
            return false;
        }
    };

    trigger2.triggerFunction = function () {};
    UPDATE_OBJECTS.push(trigger2);


    //building porte 2
    const porte2 = new StaticObject(new Vector(4500,664),PLAYER_INDEX,PLAYER_INDEX,null);
    porte2.setShape(new AABB(porte2.position.clone().add(107,35)  ,47,90));
    const porte2Sprite1 = new Sprite('porte01',porte2.position,PLAYER_INDEX-1,PLAYER_INDEX-1);
    const porte2Sprite2 = new Sprite('porte02',porte2.position.clone().add(130,0),PLAYER_INDEX+1,PLAYER_INDEX+1);
    porte2.add(portSprite1);
    porte2.add(portSprite2);
    COLLISION_OBJECTS.push(porte2);
    DRAW_OBJECTS.push(porte2Sprite1);
    DRAW_OBJECTS.push(porte2Sprite2);


    //building experience banners
    const experienceBanners = [
        {
            job:'Intern at Seabex',
            duration:'August 2022, Orléans',
            description:'Internship experience involved assisting in the analysis of satellite imagery and contributing to web programming tasks.'
        },
        {
            job:'Student Ambassador',
            duration:'2022-2023, Paris',
            description:'worker for Paris Cité university and provided guidance and support to students during university open days, fairs and visits.'
        },
        {
            job:'Game Design Summer school',
            duration:'August 2023, Finland',
            description:'Game Design & Game development summer school at the university of Turku'
        },
        {
            job:'software dev. Intern, SMABTP',
            duration:'Summer 2024, Paris',
            description:'Software developing internship involving Front End Programming, in Angular and Back End programming in Spring Boot'
        },
        {
            job:'Academic Tutor',
            duration:'2024-2025, Orsay',
            description:'Student tutor for first year student at polytech Paris Saclay, in Mathematics, Physics and computer science'
        },
        {
            job:'Full-Stack Junior Dev, Ouidou',
            duration:'summer 2025, Paris',
            description:'worked with several teams on different projects, in development, optimisation, maintenance and migration'
        },
        {
            job:'Research Engineer, Dassault Syst.',
            duration:'summer 2026, Vélizy',
            description:'Building high-performance 2D/3D manipulation, annotation and segmentation tools for volumetric medical data. Investigated server-side rendering.'
        },
    ];

    for (let i=0; i<experienceBanners.length;i++){
        const experience = new Banner2(new Vector((5+i)*1000, 600), PLAYER_INDEX-2, PLAYER_INDEX-2);
        experience.job= experienceBanners[i].job;
        experience.duration=  experienceBanners[i].duration;
        experience.description=  experienceBanners[i].description;
        DRAW_OBJECTS.push(experience);
    }




    //satellite
    const satellite = new MovingObject(new Vector(5000,200), new Vector(5350,500), PLAYER_INDEX-1, PLAYER_INDEX-1);
    const satelliteSprite = new SpriteAnimation('satellite', satellite.position, PLAYER_INDEX-1,PLAYER_INDEX-1, 150, 150,  8);
    satelliteSprite.addState("animation", 0, 8);
    satelliteSprite.setState("animation");
    satellite.add(satelliteSprite);
    satellite.setDuration(2);
    satellite.setEasing(pow2Easing);
    satellite.shouldActivate = function() {
        return satellite.endPosition.distanceTo2(PLAYER.position) < 490000;
    };
    UPDATE_OBJECTS.push(satellite);
    UPDATE_OBJECTS.push(satelliteSprite);
    DRAW_OBJECTS.push(satelliteSprite);


    //paris_cite
    const paris_cite = new MovingObject(new Vector(6430,200), new Vector(6430,530), PLAYER_INDEX, PLAYER_INDEX);
    const paris_citeSprite = new Sprite('paris_cite', paris_cite.position, PLAYER_INDEX-1,PLAYER_INDEX-1);
    paris_cite.setShape(new AABB(paris_cite.position,paris_citeSprite.width,paris_citeSprite.height));
    paris_cite.add(paris_citeSprite);
    paris_cite.setDuration(2);
    paris_cite.setEasing(pow2Easing);
    paris_cite.shouldActivate = function() {
        return paris_cite.endPosition.distanceTo2(PLAYER.position) < 490000;
    };
    UPDATE_OBJECTS.push(paris_cite);
    COLLISION_OBJECTS.push(paris_cite);
    DRAW_OBJECTS.push(paris_citeSprite);

    //gameDesign
    const gameDesign = new MovingObject(new Vector(7430,200), new Vector(7430,500), PLAYER_INDEX, PLAYER_INDEX);
    const gameDesignSprite = new SpriteAnimation('gameBoy', gameDesign.position, PLAYER_INDEX+1,PLAYER_INDEX+1, 183, 300,  8);
    gameDesign.setShape(new AABB(gameDesign.position,gameDesignSprite.frameWidth,gameDesignSprite.frameHeight));
    gameDesignSprite.addState("animation", 0, 4);
    gameDesignSprite.setState("animation");
    gameDesign.add(gameDesignSprite);
    gameDesign.setDuration(2);
    gameDesign.setEasing(pow2Easing);
    gameDesign.shouldActivate = function() {
        return gameDesign.endPosition.distanceTo2(PLAYER.position) < 490000;
    };
    UPDATE_OBJECTS.push(gameDesign);
    COLLISION_OBJECTS.push(gameDesign);
    UPDATE_OBJECTS.push(gameDesignSprite);
    DRAW_OBJECTS.push(gameDesignSprite);


    //sma btp
    const smabtp = new MovingObject(new Vector(8400,200), new Vector(8400,550), PLAYER_INDEX-1, PLAYER_INDEX-1);
    const smabtpSprite = new Sprite('smabtp', smabtp.position, PLAYER_INDEX-1,PLAYER_INDEX-1);
    smabtp.add(smabtpSprite);
    smabtp.setDuration(2);
    smabtp.setEasing(pow2Easing);
    smabtp.shouldActivate = function() {
        return smabtp.endPosition.distanceTo2(PLAYER.position) < 490000;
    };
    UPDATE_OBJECTS.push(smabtp);
    DRAW_OBJECTS.push(smabtpSprite);



    //polytech
    const polytech_logo = new MovingObject(new Vector(9430,200), new Vector(9430,800), PLAYER_INDEX, PLAYER_INDEX);
    const polytech_logoSprite = new Sprite('polytech_logo', polytech_logo.position, PLAYER_INDEX-1,PLAYER_INDEX-1);
    polytech_logo.setShape(new AABB(polytech_logo.position,polytech_logoSprite.width,polytech_logoSprite.height));
    polytech_logo.add(polytech_logoSprite);
    polytech_logo.setDuration(1);
    polytech_logo.setEasing(t=> powerEasingIn(4,t));
    polytech_logo.shouldActivate = function() {
        return polytech_logo.endPosition.distanceTo2(PLAYER.position) < 490000;
    };
    UPDATE_OBJECTS.push(polytech_logo);
    COLLISION_OBJECTS.push(polytech_logo);
    DRAW_OBJECTS.push(polytech_logoSprite);


    //ouidou
    const ouidou = new MovingObject(new Vector(10400,550), new Vector(10400,800), PLAYER_INDEX, PLAYER_INDEX,null,true);
    const ouidouSprite = new Sprite('ouidou', ouidou.position, PLAYER_INDEX-1,PLAYER_INDEX-1);
    ouidou.setShape(new AABB(ouidou.position,ouidouSprite.width,ouidouSprite.height));
    ouidou.add(ouidouSprite);
    ouidou.setDuration(1);
    ouidou.setEasing(pow2Easing);
    ouidou.shouldActivate = function() {
        return ouidou.endPosition.distanceTo2(PLAYER.position) < 490000;
    };
    UPDATE_OBJECTS.push(ouidou);
    COLLISION_OBJECTS.push(ouidou);
    DRAW_OBJECTS.push(ouidouSprite);


    //dassault
    const ds = new MovingObject(new Vector(11400,200), new Vector(11400,820), PLAYER_INDEX, PLAYER_INDEX);
    const dsSprite = new Sprite('ds', ds.position, PLAYER_INDEX-1,PLAYER_INDEX-1);
    ds.setShape(new AABB(ds.position,dsSprite.width,dsSprite.height));
    ds.add(dsSprite);
    ds.setDuration(1);
    ds.setEasing(pow2Easing);
    ds.shouldActivate = function() {
        return ds.endPosition.distanceTo2(PLAYER.position) < 490000;
    };
    UPDATE_OBJECTS.push(ds);
    COLLISION_OBJECTS.push(ds);
    DRAW_OBJECTS.push(dsSprite);

    const meditwin = new MovingObject(new Vector(11400,1300), new Vector(11400,920), PLAYER_INDEX, PLAYER_INDEX);
    const meditwinSprite = new Sprite('meditwin', meditwin.position, PLAYER_INDEX-1,PLAYER_INDEX-1);
    meditwin.setShape(new AABB(meditwin.position,meditwinSprite.width,meditwinSprite.height));
    meditwin.add(meditwinSprite);
    meditwin.setDuration(1);
    meditwin.setEasing(pow2Easing);
    meditwin.shouldActivate = function() {
        return meditwin.endPosition.distanceTo2(PLAYER.position) < 490000;
    };
    UPDATE_OBJECTS.push(meditwin);
    COLLISION_OBJECTS.push(meditwin);
    DRAW_OBJECTS.push(meditwinSprite);



    // Sort by zIndex ascending (lower zIndex = drawn first)
    DRAW_OBJECTS.sort((a, b) => a.zIndexDraw - b.zIndexDraw);
    COLLISION_OBJECTS.sort((a, b) => a.zIndexCollision - b.zIndexCollision);
    UPDATE_OBJECTS.sort((a, b) => a.zIndexCollision - b.zIndexCollision);

}

function gameLoop() {
    // --- UPDATE ---
    for (const obj of UPDATE_OBJECTS) {
        obj.update();
    }
    PLAYER.update();
    CAMERA.update();

    // --- RENDER ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const obj of DRAW_OBJECTS) {
        if (obj.zIndexDraw <= PLAYER.zIndexDraw) obj.draw(ctx, CAMERA);
    }
    PLAYER.draw(ctx, CAMERA);
    for (const obj of DRAW_OBJECTS) {
        if (obj.zIndexDraw > PLAYER.zIndexDraw) obj.draw(ctx, CAMERA);
    }

}