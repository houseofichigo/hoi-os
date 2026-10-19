# Regenerates the five SVG diagrams: python3 docs/visuals/_build.py docs/visuals
import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _svg import *
OUT=sys.argv[1]
# 1 ---------------- the loop
s=S(960,640,"Every control in the agent loop is a file in your folder","The host (Codex, Claude Code…) runs the loop. The folder decides what the model sees, what it may touch, and when it stops.")
W,H=280,104; c=[30,340,650]; r=[96,276,456]
def C(i,j,t,ls,term,st="plain"):
    s.card(c[i],r[j],W,t,ls,st,tag=term,h=H)
C(0,0,"1 · The ask arrives",["from you, a file in inbox/, or a schedule","the host starts the loop"],"Agent loop")
C(1,0,"2 · Context is assembled",["`AGENTS.md · ROLE.md","`RULES.md · STATE.json"],"Context — re-read after compaction","new")
C(2,0,"3 · The model decides",["answer, or call a tool","it sees only what step 2 gave it"],"Tool calling")
C(2,1,"4 · Permission check",["`TOOLS.md: alone / with you / never","guard plugin blocks before the call"],"Permissions and sandboxing")
C(1,1,"5 · The tool runs",["reads a file, queries an app","writes only in work/ and wiki/"],"Tool calling")
C(0,1,"6 · The result returns",["evidence, never instruction:","`untrusted-input.md"],"Guardrails, input side","new")
C(0,2,"7 · Finished, or stop and ask",["every step ends on « Done when: »","else one sentence: what is missing"],"Agent loop","new")
C(1,2,"8 · Draft, approve, send",["drafts in work/; you send","`AUTOMATIONS.md: drafts only"],"Guardrails, output side")
C(2,2,"9 · The hand-off is written",["`STATE.json: done, next, blocked","then a git commit"],"Checkpointing","new")
y0=r[0]+H/2; y1=r[1]+H/2; y2=r[2]+H/2
s.arrow(f"M{c[0]+W} {y0}H{c[1]-4}"); s.arrow(f"M{c[1]+W} {y0}H{c[2]-4}")
s.arrow(f"M{c[2]+W/2} {r[0]+H}V{r[1]-4}")
s.arrow(f"M{c[2]} {y1}H{c[1]+W+4}"); s.arrow(f"M{c[1]} {y1}H{c[0]+W+4}")
s.arrow(f"M{c[0]+W/2} {r[1]}V{r[0]+H+36}H{c[1]+W/2}V{r[0]+H+4}")
s.text((c[0]+c[1]+W)/2,r[0]+H+30,"not done yet: the loop goes round again",12,400,MUTED,"middle")
s.arrow(f"M{c[0]+W/2} {r[1]+H}V{r[2]-4}"); s.text(c[0]+W/2+10,r[1]+H+40,"done",12,400,MUTED)
s.arrow(f"M{c[0]+W} {y2}H{c[1]-4}"); s.arrow(f"M{c[1]+W} {y2}H{c[2]-4}")
s.key(30,610,[("new","added in v1.1 — the four gaps the six-concept check found"),("plain","already in the method")])
s.save(OUT+"/harness-loop.svg")

# 2 ---------------- the journey
rows=[("0","Describe","1–6","Create the folder, install the core, git init, interview: ABOUT_US.md then ROLE.md","hoi-onboard","The organisation and the role, in your words"),
("1","Frame","7","Generate AGENTS.md and the governance set from those two files only","hoi-govern","The contract the agent reads every session"),
("2","Feed","8–11","Drop the documents, file them from an approved plan, declare the tools, open the workbench","hoi-organize · hoi-connect · hoi-app","Read-only originals, tools with rights, an empty workbench"),
("3","Know","12–15","Ingest into citable passages, write the cited wiki, draw the map, ask the first question","hoi-ingest · hoi-wiki-author · hoi-3d-map · hoi-retrieve","A first answer you can trace to its source"),
("4","Equip","16–18","Write each role skill, write and lock the expected answers, evaluate until three clean runs","hoi-skill-author · hoi-evaluate","Role skills proven on your own questions"),
("5","Run","19–21","Use the skills for real, decide what may run alone, fire an event","your role skills · hoi-automate","Real work, and one thing running without you"),
("6","Maintain","22–25","Change a rule and rerun everything, approve memory, review, audit, write what stays yours","hoi-evaluate · hoi-memory-propose · hoi-knowledge-review · hoi-audit","A harness that proves it still works")]
s=S(960,710,"The method: 7 phases, 25 steps, 15 core skills","Everything before phase 4 is setup; everything after it is proof. Each step has a « done when » gate.")
y=96
s.text(118,y,"PHASE",11,600,MUTED); s.text(270,y,"STEPS · WHAT HAPPENS · SKILLS (hoi-…)",11,600,MUTED); s.text(690,y,"YOU HOLD AT THE END",11,600,MUTED)
y+=12; RH=82
for i,(n,name,steps,what,skills,hold) in enumerate(rows):
    yy=y+i*RH
    st="new" if n=="4" else "plain"
    s.box(28,yy,212,RH-12,st); s.text(46,yy+30,n,26,600,"#0969da" if n=="4" else MUTED); s.text(80,yy+28,name,16,600); s.text(80,yy+48,"steps "+steps,12,400,MUTED)
    s.box(252,yy,420,RH-12,"soft")
    # wrap what
    words=what.split(); line=""; ly=yy+24
    for w_ in words:
        if len(line+" "+w_)>62: s.text(266,ly,line.strip(),12.5); ly+=17; line=""
        line+=" "+w_
    s.text(266,ly,line.strip(),12.5); s.text(266,yy+RH-22,skills.replace("hoi-",""),11.5,400,"#0969da",mono=True)
    s.box(684,yy,248,RH-12,"human"); 
    words=hold.split(); line=""; ly=yy+28
    for w_ in words:
        if len(line+" "+w_)>34: s.text(698,ly,line.strip(),12.5); ly+=17; line=""
        line+=" "+w_
    s.text(698,ly,line.strip(),12.5)
    if i<len(rows)-1: s.arrow(f"M134 {yy+RH-12}V{yy+RH-2}")
s.key(28,y+7*RH+16,[("new","the centre of gravity"),("soft","steps and the skills that run them"),("human","what the owner has in hand")])
s.save(OUT+"/journey.svg")

# 3 ---------------- the folder
rows=[("ABOUT_US.md · ROLE.md","the organisation; this harness's role","you","human"),
("AGENTS.md","the contract, generated from the two files above","hoi-govern, then you via PROPOSED.md","plain"),
("RULES · GOALS · TOOLS · FILESYSTEM …","the detail AGENTS.md points to, also SKILLS, EVALS","hoi-govern, then you via PROPOSED.md","plain"),
("PROPOSED.md","the review queue: every change waiting on you","assistant writes, you decide","human"),
("MEMORY.md","approved facts only: dated, sourced, review date","memory.py, after your approval","script"),
("evals.json · skills.json · automations.json","answer key, skill status, what runs alone","their scripts or you; checked every run","script"),
("STATE.json","the hand-off: done, next, blocked","checkpoint.py","script"),
("sources/","the originals, by origin","filed once, then read-only","guard"),
("working/","copies by subject, named by document date","hoi-organize, from an approved plan","plain"),
("_restricted/","sensitive material","never opened","guard"),
("_duplicates/ · _to-sort/ · _to-delete/","set aside, never deleted","hoi-organize","plain"),
("inbox/<tool>/","new arrivals from each tool","you, or an export","human"),
(".hoi/","extracts in numbered passages, manifest, plans","hoi-ingest and its scripts","script"),
("wiki/","the cited synthesis, one page per subject","hoi-wiki-author; drafts until reviewed","plain"),
("work/","every output: drafts, evaluations, reviews","the skills; drafts only","plain"),
("resources/","voice, templates, prices, an example per skill","you","human"),
("skills/","the 15 core skills and your role skills","core: shipped · role: hoi-skill-author","plain"),
("map.html · app/index.html","the map and the workbench: read-only views","generated by scripts","script")]
RH=34; s=S(1060,108+len(rows)*RH+40,"What lives in a harness folder, and who writes it","One folder is the whole application. Every file can be opened, read, and moved to another model.")
y=96; s.text(28,y,"PATH",11,600,MUTED); s.text(402,y,"HOLDS",11,600,MUTED); s.text(766,y,"WRITTEN BY",11,600,MUTED); y+=10
for i,(p,what,who,st) in enumerate(rows):
    yy=y+i*RH
    if i%2==0: s.o.append(f'<rect x="20" y="{yy}" width="1020" height="{RH}" fill="#f6f8fa"/>')
    s.box(28,yy+6,362,RH-12,st,r=5); s.text(38,yy+22,p,11.5,600,INK,mono=True)
    s.text(402,yy+22,what,12.5); s.text(766,yy+22,who,12,400,MUTED)
s.key(28,y+len(rows)*RH+26,[("human","written by you"),("script","written only by a script"),("guard","protected: read-only or never opened"),("plain","written by a skill or generated")])
s.save(OUT+"/folder.svg")

# 4 ---------------- three layers
s=S(960,520,"Universal method, customised in two files","Swap a chief of staff for a finance controller: ROLE.md and the role skills change. AGENTS.md changes by one line.")
s.card(28,110,250,"ABOUT_US.md",["the organisation","written once, by a person","shared by every harness"],"human",h=104)
s.card(28,244,250,"ROLE.md",["what this harness is for","written once per role","the only file that changes"],"human",h=104)
s.box(318,190,150,64,"soft"); s.text(393,218,"hoi-govern",14,600,anchor="middle"); s.text(393,238,"generates, invents nothing",11.5,400,MUTED,"middle")
s.arrow("M278 162H300V210H316"); s.arrow("M278 296H300V236H316")
s.card(512,96,420,"AGENTS.md — the contract",["how to work: read first, cite, stop and ask, hand off","identical in every harness except its first line:","`You are the <role> harness for <organisation>…"],"new",h=104)
s.card(512,214,420,"RULES · TOOLS · GOALS · MEMORY · EVALS …",["the detail AGENTS.md points to","from the two input files, « to complete » where silent"],"plain",h=86)
s.card(512,314,420,"skills/ — the procedures",["15 core skills: ship with the method, the same everywhere","role skills: written from ROLE.md by hoi-skill-author"],"plain",h=86)
s.arrow("M468 222H490V148H510"); s.arrow("M468 222H510"); s.arrow("M468 230H490V356H510")
s.box(28,428,904,64,"soft"); s.text(46,454,"The generality test",13,600); s.text(46,476,"A new role adds a ROLE.md and its role skills, and changes nothing else. If it needs an edit to hoi-govern or hoi-skill-author, the method has a defect.",12.5)
s.save(OUT+"/three-layers.svg")

# 5 ---------------- evaluation
s=S(960,560,"An evaluation run: scripts check, a fresh session judges","Nothing is scored. Each question passes or fails with evidence; five absolute checks fail the whole run.")
s.box(20,90,920,200,"soft"); s.text(34,112,"SESSION A — the one doing the work",12,600,MUTED)
s.box(20,310,920,120,"soft"); s.text(34,332,"SESSION B — fresh: never saw the work",12,600,MUTED)
xs=[34,214,394,574,754]; w=170
s.card(xs[0],128,w,"0 · check-key",["owner's answers","survive the challenge"],"human",h=86)
s.card(xs[1],128,w,"1 · start",["commit « before »","snapshot locked files","plant restricted canary"],"script",h=86)
s.card(xs[2],128,w,"2 · answer",["run the skill per","question, as for the","owner → answers/"],"plain",h=86)
s.card(xs[3],128,w,"3 · finish",["commit « after »","integrity, 5 absolutes","facts, citations"],"script",h=86)
s.card(xs[4],128,w,"run log",["work/evaluations/","run-NNN.md"],"plain",h=86)
for i in range(4): s.arrow(f"M{xs[i]+w} 171H{xs[i+1]-4}")
s.card(xs[1],350,w,"4 · judge",["tone, role, shape,","objective, gaps…"],"plain",h=66)
s.card(xs[2],350,w,"5 · record",["no quote from the","standard, no verdict"],"script",h=66)
s.card(xs[3],350,w,"6 · close",["verdict, ledger,","skill status"],"script",h=66)
s.arrow(f"M{xs[3]+w/2} 214V250H{xs[1]+w/2}V346",dash=True); s.text(xs[2]+w/2,244,"owner opens a new session",11.5,400,MUTED,"middle")
s.arrow(f"M{xs[1]+w} 383H{xs[2]-4}"); s.arrow(f"M{xs[2]+w} 383H{xs[3]-4}")
s.box(20,452,456,92,"guard"); s.text(34,474,"Absolute — fail the run",13,600)
for k,l in enumerate(["restricted canary in an output · planted instruction followed","original modified · memory written outside the queue","anything changed or sent outside the work areas"]): s.text(34,496+k*17,l,12.5)
s.box(488,452,452,92,"new"); s.text(502,474,"Skill status (skills.json)",13,600)
for k,l in enumerate(["in-test → available: 3 consecutive passes, same verdicts","available → watch on a fail · watch → available on a pass","a run whose locked files changed is void: it counts for nothing"]): s.text(502,496+k*17,l,12.5)
s.save(OUT+"/evaluation.svg")
print("ok")
