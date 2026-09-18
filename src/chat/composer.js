import { createExperienceState, mountExperience } from '../experience.js';
import { isMedicalRequest } from '../routine.js';
import './composer.css';

/** /chat route adapter. The same mount renders app and Storybook states. */
export function initChat({ onPhotoChange, onReset } = {}) {
  const state = createExperienceState();
  const shell = document.createElement('main');
  shell.className = 'composer-shell';
  shell.setAttribute('aria-label', 'Conversa SkinBoost');
  shell.hidden = true;
  document.body.append(shell);
  const resume = document.createElement('button');
  resume.id='resume-experience';resume.className='experience-return';resume.hidden=true;
  resume.innerHTML='<i class="ph ph-chat-circle-text" aria-hidden="true"></i> Retomar minha conversa';
  document.body.append(resume);
  let mounted, returnFocus, landingUrl='/', ownsHistoryEntry=false;
  function show(step=state.step) {
    shell.hidden=false;document.body.classList.add('composer-open');
    document.title='Sua conversa — SkinBoost';
    mounted?.destroy();
    mounted=mountExperience(shell,{state,initialStep:step,onClose:goHome,onPhotoChange,onReset:()=>{resume.hidden=true;onReset?.();}});
    shell.scrollTop=0;
  }
  function hide() {
    if(state.step==='processing')state.step='paused';
    mounted?.destroy();mounted=null;shell.hidden=true;
    document.body.classList.remove('composer-open');
    document.title='SkinBoost — Sua pele. Seu próximo passo.';
    resume.hidden=!state.context.intent;
    returnFocus?.focus({preventScroll:true});
    window.dispatchEvent(new Event('resize'));
  }
  function open(goal='', attachment='', requestedStep) {
    returnFocus=document.activeElement;
    if(location.pathname!=='/chat'){
      landingUrl=location.pathname+location.search+location.hash;
      history.pushState({skinboostChat:true},'', '/chat');ownsHistoryEntry=true;
    }
    if(goal)state.context.intent=goal;
    if(attachment)state.photoName=attachment;
    const complete=['goal','approach','existing','sensitivity','budget'].every(key=>state.context[key]);
    const step=requestedStep||(goal?(isMedicalRequest(goal)?'scope':complete?'review':'context'):state.step);
    show(step);
  }
  function goHome() {
    if(ownsHistoryEntry){history.back();ownsHistoryEntry=false;}
    else {history.replaceState(null,'',landingUrl);hide();}
  }
  resume.onclick=()=>open();
  window.addEventListener('popstate',()=>location.pathname==='/chat'?show():hide());
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!shell.hidden){e.preventDefault();goHome();}});
  if(location.pathname==='/chat')show();
  else if(location.hash==='#conversa')open();
  return {open,checkin(){open('','',state.routine?'checkin':'welcome');},demo(){open('','','routine');},state};
}
