"""Adapt the preserved, rigged pasture bull into an adult tawny dairy cow."""
import io
import math

import numpy as np
from PIL import Image
from sculpt_pasture_livestock import Asset, recontour, smooth


def silhouette(points):
    x, y, z = points.T
    back = smooth(-.14, .08, y)
    shoulder = np.exp(-((z - .20) / .17)**2)
    rib = np.exp(-((z + .08) / .22)**2)
    hip = np.exp(-((z + .29) / .12)**2)
    cheek = smooth(.28, .38, z) * smooth(.04, .13, y)
    horn = smooth(.236, .28, y) * smooth(.29, .37, z)
    out = points.copy()
    # Narrow the brisket and withers; keep a barrel-shaped abdomen and high hip.
    out[:, 0] += (x - .024) * (-.34*shoulder*back + .105*rib + .08*hip - .17*cheek - .34*horn)
    out[:, 1] -= .052*shoulder*smooth(.07,.27,y) + .026*horn
    out[:, 1] += .014*hip*back + .033*shoulder*(1-smooth(-.11,.025,y))*smooth(-.22,-.12,y)
    belly = np.exp(-((y + .055)/.09)**2)
    out[:, 1] -= .028*rib*belly
    out[:, 2] += .023*horn - .015*hip*back
    # The source belly has a male sheath. Lift that central patch into the abdomen.
    out[:, 1] += .027*np.exp(-((x-.024)/.031)**2-((z+.11)/.065)**2)*belly
    return out


def udder(asset):
    points, faces, colors = [], [], []
    def lobe(center, radii, teat=False):
        start = len(points)
        rings, segments = (11, 14) if teat else (18, 40)
        for row in range(rings+1):
            theta = math.pi*(.0001+.9998*row/rings)
            for column in range(segments):
                phi = 2*math.pi*column/segments
                radial = math.sin(theta)**(.58 if teat else .83)
                x = radial*math.cos(phi); z = radial*math.sin(phi); y = math.cos(theta)
                # A shallow median groove and gently fuller rear quarters.
                crease = 0 if teat else .007*np.exp(-(x/.17)**2)*max(0., -y)
                points.append([center[0]+radii[0]*x, center[1]+radii[1]*y+crease+(.005*z if not teat else 0), center[2]+radii[2]*z])
                tone = [.35,.20,.135] if teat else [.46,.293,.192]
                colors.append(np.array(tone)*(.90+.11*y+.04*math.cos(3*phi)))
                if row:
                    a=start+(row-1)*segments+column; b=start+(row-1)*segments+(column+1)%segments
                    faces.extend([[a,b,a+segments],[b,b+segments,a+segments]])
    lobe([.024,-.079,-.217],[.068,.065,.112])
    for side in [-1,1]:
        for end in [-1,1]:
            lobe([.024+side*.029,-.133+end*.002,-.218+end*.046],[.007,.023,.007],True)
    # The mammary tissue follows the pelvis, independent of the legs.
    asset.geometry('Udder and four teats', points, faces, colors, [[0,0,0,0]]*len(points), [[1,0,0,0]]*len(points), .9)


def build():
    asset=Asset('pasture-bull.glb'); points, normals, _ = asset.surface()
    recontour(asset,points,normals,silhouette)
    mat=asset.doc['materials'][0]['pbrMetallicRoughness']
    texture=asset.doc['textures'][mat['baseColorTexture']['index']]
    image=asset.doc['images'][texture['source']]; view=asset.doc['bufferViews'][image['bufferView']]
    start=view.get('byteOffset',0)
    original=Image.open(io.BytesIO(asset.data[start:start+view['byteLength']])).convert('RGB')
    pixels=np.asarray(original,dtype=float)/255
    lum=pixels @ [.30,.56,.14]
    buff=np.stack([lum**.75*1.10+.10,lum**.80*.98+.082,lum**.89*.78+.053],axis=-1)
    # Retain the dark muzzle, eyelids, hoof capsules and source hair detail.
    coverage=smooth(.065,.295,lum)[:,:,None]
    rgb=np.clip(buff*coverage+pixels*(1-coverage),0,1)
    buf=io.BytesIO();Image.fromarray((rgb*255).astype('uint8')).save(buf,'JPEG',quality=92)
    image['bufferView']=asset.blob(buf.getvalue())
    udder(asset)
    asset.doc['asset']['extras'].update(adaptation='Adult dairy cow. New Babylon adaptation of the retained pasture bull. Fawn coat, narrow forequarters, wider pelvis and rib cage, shorter horns and a skinned udder with four teats.', walk_stride=.56)
    asset.write('cow')


if __name__=='__main__':
    build()
