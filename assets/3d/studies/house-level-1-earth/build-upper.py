"""Build the larger single-tile family houses using the level I earth and timber kit.

python build-upper.py /tmp/house-2-raw.glb --tier 2 --city
Then run postprocess.py and city-mesh.cjs as for level I.
"""
import argparse
from pathlib import Path
from earth_geometry import bowl, clay, export, jar, make_ground, plaster, pole, pot, rng, slab, straw, surface
from courtyard_parts import awning, front_wall, hanging, ladder, mat, room

def second():
    main=room(.0,-1.43,4.45,1.67,.045,2.51,.45,.91)
    room(-1.61,.31,1.32,2.03,.042,1.91,-1.58,.66,finish=(191,169,139))
    slab(2.17,.75,.23,2.96,.035,.90,plaster,.055,.20,.038)
    slab(-2.19,1.67,.22,1.26,.034,.77,plaster,.046,.20,.043)
    front_wall(.47,1.35)
    awning(.48,.27,2.28,1.60,.045,1.91,1.65)
    ladder(2.21,-1.52,.045,main)
    # The wing ends at the domestic work yard: a raised mudbrick bench and water jars.
    slab(1.79,1.01,.43,1.00,.045,.43,clay,.075)
    jar(1.81,1.25,.435,.31,bowl,(164,116,83))
    jar(-.89,1.81,.055,.64,pot,(164,115,84))
    jar(-1.35,1.88,.055,.40,pot,(184,149,112))
    jar(-1.72,.86,1.82,.33,bowl,(163,113,85))
    mat(-.11,1.43,1.18,.62,.073)
    hanging(-1.96,2.347,.52,.75,.35)
    for i in range(6):
        surface('reed');pole((-.82,main+.028,-1.92+.032*i),(.29,main+.028,-1.92+.032*i),.020,straw,6)
    surface('earth')


def third():
    floor=room(-.14,-1.29,3.91,1.90,.046,2.35,-.56,.91)
    room(-1.59,.49,1.25,1.82,.043,1.96,-1.56,.55,finish=(193,171,142))
    ceiling=room(-1.13,-1.52,1.74,1.30,floor,1.87,-.97,.60,finish=(208,187,154))
    # Stairs rise along the east side from the open court to a real landing.
    x=1.99;width=.68;z_start=1.95;run=.265;steps=11
    landing=floor+.18
    for i in range(steps):
        z=z_start-run*i; h=.045+(landing-.045)*(i+1)/steps
        slab(x,z,width,run+.04,.043,h,(182,155,122),.034,.24,.012)
    slab(x,-1.10,width,.68,.044,landing,plaster,.04)
    slab(1.62,-1.09,.58,.61,floor-.06,landing+.005,(185,162,129),.023)
    # A parapeted terrace over the lower hall, with shade open to the street.
    slab(.74,-2.14,1.74,.15,floor,floor+.32,plaster,.036)
    slab(1.71,-1.85,.14,.65,floor,floor+.32,plaster,.036)
    awning(.72,-1.17,1.46,1.28,floor,3.67,3.52)
    ladder(-.24,-1.81,floor,ceiling,.28)
    slab(-2.18,1.73,.20,1.27,.035,.88,plaster,.05)
    slab(2.27,1.89,.18,.87,.035,.61,plaster,.038)
    front_wall(-.33,1.17)
    # A sheltered lower court remains legible beneath the occupied upper rooms.
    awning(-.39,.08,1.20,.78,.046,1.78,1.54)
    jar(.86,1.76,.055,.69,pot,(154,107,81))
    jar(.34,1.92,.053,.41,pot,(182,146,105))
    jar(.92,-1.68,floor+.04,.41,bowl,(154,106,83))
    jar(-1.75,1.60,.053,.38,pot,(157,115,87))
    mat(-.45,1.20,1.02,.62,.074)
    hanging(-1.85,-.887,.61,ceiling+.16,.43)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('--tier',type=int,choices=(2,3),required=True)
    parser.add_argument('--city',action='store_true')
    args=parser.parse_args()
    rng.seed(2718+args.tier)
    make_ground()
    (second if args.tier==2 else third)()
    export(args.output,'Courtyard house '+('II' if args.tier==2 else 'III'))
