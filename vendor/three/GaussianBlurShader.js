/**
 * Minimal Gaussian blur shader required by UnrealBloomPass.
 * Ported from three.js examples to ensure compatibility with legacy builds.
 */

THREE.GaussianBlurShader = {

        defines: {
                "SIGMA": 2.0,
                "KERNEL_RADIUS": 3
        },

        uniforms: {
                "tDiffuse": { value: null },
                "uImageIncrement": { value: new THREE.Vector2( 0.001953125, 0.0 ) },
                "cKernel": { value: [] }
        },

        vertexShader: [
                "varying vec2 vUv;",
                "uniform vec2 uImageIncrement;",
                "void main() {",
                "\tvUv = uv - ( float( KERNEL_RADIUS ) ) * uImageIncrement;",
                "\tgl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
                "}"
        ].join( "\n" ),

        fragmentShader: [
                "uniform sampler2D tDiffuse;",
                "uniform float cKernel[ KERNEL_RADIUS * 2 + 1 ];",
                "uniform vec2 uImageIncrement;",
                "varying vec2 vUv;",
                "void main() {",
                "\tvec2 imageCoord = vUv;",
                "\tvec4 sum = vec4( 0.0 );",
                "\tfor( int i = 0; i < KERNEL_RADIUS * 2 + 1; i++ ) {",
                "\t\tsum += texture2D( tDiffuse, imageCoord ) * cKernel[ i ];",
                "\t\timageCoord += uImageIncrement;",
                "\t}",
                "\tgl_FragColor = sum;",
                "}"
        ].join( "\n" )
};

THREE.GaussianBlurShader.buildKernel = function( sigma ) {

        function gauss( x, sigma ) {
                return Math.exp( - ( x * x ) / ( 2.0 * sigma * sigma ) );
        }

        var kernelSize = 2 * Math.ceil( sigma * 3.0 ) + 1;
        var halfWidth = ( kernelSize - 1 ) * 0.5;
        var kernel = new Array( kernelSize );
        var sum = 0.0;

        for ( var i = 0; i < kernelSize; i ++ ) {
                kernel[ i ] = gauss( i - halfWidth, sigma );
                sum += kernel[ i ];
        }

        // Normalize the kernel so the total weight = 1.0
        for ( var j = 0; j < kernelSize; j ++ ) {
                kernel[ j ] = kernel[ j ] / sum;
        }

        return kernel;

};
