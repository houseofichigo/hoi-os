from html import escape as E
INK="#1f2328"; MUTED="#59636e"; LINE="#8c959f"; GRID="#d0d7de"
STY={"plain":("#ffffff","#8c959f",1.25),"new":("#ddf4ff","#0969da",2),"human":("#fff8c5","#9a6700",1.5),
     "script":("#dafbe1","#1a7f37",1.5),"guard":("#ffebe9","#cf222e",1.5),"soft":("#f6f8fa","#d0d7de",1)}
class S:
    def __init__(s,w,h,title,sub=None):
        s.w,s.h=w,h; s.o=[]; s.t=title
        s.o.append(f'<rect width="{w}" height="{h}" fill="#ffffff"/>')
        s.text(28,40,title,18,600)
        if sub: s.text(28,64,sub,13,400,MUTED)
    def text(s,x,y,t,size=13,weight=400,fill=INK,anchor="start",mono=False):
        fam='ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' if mono else '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif'
        s.o.append(f'<text x="{x}" y="{y}" font-family="{fam}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{E(t)}</text>')
    def box(s,x,y,w,h,style="plain",r=8):
        f,st,sw=STY[style]
        s.o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{f}" stroke="{st}" stroke-width="{sw}"/>')
    def card(s,x,y,w,title,lines=(),style="plain",tag=None,center=False,lh=17,h=None):
        h=h or 34+lh*len(lines)+(18 if tag else 0)+4
        s.box(x,y,w,h,style)
        if center: s.text(x+w/2,y+22,title,14,600,anchor="middle")
        else: s.text(x+14,y+22,title,14,600)
        yy=y+22+lh
        for l in lines:
            mono=l.startswith("`"); 
            s.text(x+14 if not center else x+w/2,yy,l.strip("`"),12.5,400,INK,"middle" if center else "start",mono); yy+=lh
        if tag: s.text(x+14,yy+2,tag,11.5,400,MUTED)
        return h
    def arrow(s,d,color=LINE,dash=False):
        s.o.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.4" marker-end="url(#a)"{" stroke-dasharray=\"5 4\"" if dash else ""}/>')
    def line(s,x1,y1,x2,y2,color=GRID,w=1):
        s.o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}"/>')
    def key(s,x,y,items):
        for style,label in items:
            f,st,sw=STY[style]
            s.o.append(f'<rect x="{x}" y="{y-11}" width="14" height="14" rx="3" fill="{f}" stroke="{st}" stroke-width="{sw}"/>')
            s.text(x+20,y+1,label,12,400,MUTED); x+=20+7.2*len(label)+22
    def save(s,path):
        head=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s.w} {s.h}" width="{s.w}" height="{s.h}" role="img" aria-label="{E(s.t)}">'
              f'<title>{E(s.t)}</title><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
              f'<path d="M0 0L10 5L0 10z" fill="{LINE}"/></marker></defs>')
        open(path,"w").write(head+"".join(s.o)+"</svg>\n")
