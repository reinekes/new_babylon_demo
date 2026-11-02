// Use Babylon's own image-processing functions for custom sky/water shaders, so
// fog has the same exposure, ACES curve and contrast as the adjacent PBR ground.
export const atmosphereUniforms=['valleyFogColor','valleyFogDensity','exposureLinear','contrast'];
export const atmosphereDeclarations=`
#include<helperFunctions>
#include<imageProcessingDeclaration>
#include<imageProcessingFunctions>
uniform vec3 valleyFogColor;
uniform float valleyFogDensity;
vec3 valleyFog(vec3 linearColor,vec3 worldPoint,vec3 eye){
 float distanceToEye=length(worldPoint-eye);
 float visibility=exp(-2.2*pow(distanceToEye*valleyFogDensity,2.0));
 return mix(valleyFogColor,linearColor,visibility);
}`;
export function atmosphereDefines(scene){
 const ip=scene.imageProcessingConfiguration;
 return ['#define EXPOSURE','#define CONTRAST',`#define TONEMAPPING ${ip.toneMappingEnabled?ip.toneMappingType+1:0}`];
}
export function bindAtmosphere(scene,material){
 const ip=scene.imageProcessingConfiguration;
 material.setColor3('valleyFogColor',scene.fogColor);
 material.setFloat('valleyFogDensity',scene.fogMode===2?scene.fogDensity:0);
 material.setFloat('exposureLinear',ip.exposure);
 material.setFloat('contrast',ip.contrast);
}
