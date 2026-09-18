import './experience.css';
import { CATALOG, DEFAULT_CONTEXT, buildRoutine, validatePhoto, isMedicalRequest, formatMoney } from './routine.js';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name) => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
const money = formatMoney;
const questions = [
  { key:'goal', title:'O que merece atenção primeiro?', description:'Escolha o que você percebe. Isso organiza a conversa; não define um diagnóstico.', choices:[['hidratação','Quero mais conforto','Ressecamento que percebo no dia a dia.','drop'],['oleosidade','Quero entender a oleosidade','Antes de acrescentar mais produtos.','sun'],['conhecer','Quero começar pelo básico','Entender a função de cada passo.','leaf']] },
  { key:'approach', title:'Como o cuidado cabe no seu dia?', description:'Uma rotina útil é aquela que você consegue manter.', choices:[['Poucos passos','Poucos passos','O essencial, sem complicar.','circles-three'],['Ajustar o que já uso','Ajustar o que já uso','Aproveitar a rotina que já existe.','sliders-horizontal'],['Explorar possibilidades','Explorar possibilidades','Conhecer também um passo complementar.','sparkle']] },
  { key:'existing', title:'O que já faz parte da sua rotina?', description:'Assim, podemos evitar sugerir uma compra repetida.', choices:[['Nenhum produto','Estou começando','Ainda não tenho uma rotina.','plant'],['Já uso limpeza','Já tenho um limpador','Quero conhecer os outros passos.','drop'],['Já uso limpeza e hidratação','Já limpo e hidrato','Quero aproveitar esses produtos.','check-circle']], custom:'Ou descreva o que já usa', placeholder:'Ex.: uso um limpador e um hidratante à noite.' },
  { key:'sensitivity', title:'Tem algo que a gente precisa respeitar?', description:'Se você não sabe, tudo bem. Não vamos presumir o que sua pele tolera.', choices:[['Não sei','Ainda não sei','Quero entender antes de escolher.','question'],['Tenho sensibilidade ou restrições','Tenho sensibilidade ou restrições','Preciso conferir composição e orientação profissional.','hand-heart'],['Nenhuma restrição conhecida','Nenhuma restrição conhecida','Isso não garante tolerância a um novo produto.','check']] },
  { key:'budget', title:'Qual limite faz sentido para você?', description:'Os valores desta experiência são fictícios, para demonstrar a comparação. Não são preços de venda.', choices:[['Até R$ 120','Até R$ 120','Começar com um limite menor.','wallet'],['Até R$ 150','Até R$ 150','Priorizar uma rotina curta.','wallet'],['Até R$ 250','Até R$ 250','Explorar outras possibilidades.','wallet'],['Prefiro decidir depois','Decidir depois','Ver os valores antes de escolher.','arrow-right']], custom:'Ou informe outro limite em reais', placeholder:'Ex.: R$ 90', inputmode:'decimal' }
];

export function createExperienceState() {
  return { context:{...DEFAULT_CONTEXT}, photoName:'', step:'welcome', question:0, routine:null, selected:[], checkin:null, events:[], revision:0, error:'', draft:'', returnStep:'', orderReviewed:false };
}

export function mountExperience(element, options={}) {
  const state = options.state || createExperienceState();
  let disposed = false, timer = null, noticeTimer = null;
  const local = (sel) => element.querySelector(sel);
  const all = (sel) => [...element.querySelectorAll(sel)];
  const log = (name, detail={}) => { state.events.push({name, ...detail}); options.onChange?.(state); };
  const seed = () => {
    state.context = {...state.context, intent:'Quero uma rotina simples, aproveitando o que já uso.', goal:'hidratação', approach:'Poucos passos', existing:'Nenhum produto', sensitivity:'Não sei', budget:'Até R$ 150'};
    state.routine=buildRoutine(state.context); state.selected=state.routine.products.map(p=>p.id);
  };
  state.step = options.initialStep || state.step;
  if (['routine','cart','checkout','checkin'].includes(state.step) && !state.routine) seed();
  if(state.step==='context'&&!state.context.intent) state.context.intent='Quero começar com uma rotina simples.';
  element.classList.add('sb-experience');

  function go(step, extra={}) { Object.assign(state, extra, {step,error:''}); render(); }
  function say(text) { const node=local('[data-live]'); if(node)node.textContent=text; }
  function notify(text) { say(text); clearTimeout(noticeTimer); noticeTimer=setTimeout(()=>say(''),4500); }
  function button(text, action, variant='primary', attrs='') { return `<button type="button" class="sx-button sx-${variant}" data-action="${action}" ${attrs}>${text}</button>`; }
  function title(kicker, heading, description='') { return `<div class="sx-heading"><span class="sx-kicker">${kicker}</span><h2 id="dialog-title" tabindex="-1">${heading}</h2>${description?`<p>${description}</p>`:''}</div>`; }
  function hint(text, type='info') { return `<div class="sx-hint sx-${type}">${icon(type==='alert'?'info':'leaf')}<p>${text}</p></div>`; }
  function priceNote() { return '<p class="sx-footnote">Valores fictícios · demonstração de escolha e cálculo, sem oferta comercial.</p>'; }
  function contextSummary() {
    const filled=questions.filter(q=>state.context[q.key]);
    return `<div class="sx-context"><div class="sx-label-row"><span class="sx-kicker">O que você contou</span>${filled.length?button('Editar','edit-all','text'):''}</div>${state.context.intent?`<blockquote>${esc(state.context.intent)}</blockquote>`:'<p>Seu contexto aparece aqui, à medida que você escolhe.</p>'}<dl>${filled.map(q=>`<div><dt>${({goal:'Foco',approach:'Ritmo',existing:'Sua rotina',sensitivity:'Cuidados',budget:'Orçamento'})[q.key]}</dt><dd>${esc(state.context[q.key])}${button(icon('pencil-simple')+'<span class="sr-only">Editar '+({goal:'foco',approach:'ritmo',existing:'produtos atuais',sensitivity:'cuidados',budget:'orçamento'})[q.key]+'</span>','edit-field','icon',`data-key="${q.key}"`)}</dd></div>`).join('')}</dl>${state.photoName?`<div class="sx-file">${icon('file-image')}<span>${esc(state.photoName)}</span>${button(icon('x')+'<span class="sr-only">Remover foto</span>','remove-photo','icon')}</div>`:''}<p class="sx-footnote">${state.photoName?'Foto anexada apenas como referência nesta demonstração; sem análise.':'Você pode concluir tudo sem uma foto.'}</p></div>`;
  }
  function rail() {
    const phase=['welcome','context','review','processing','paused','scope'].includes(state.step)?0:['routine','source','comparison','checkin'].includes(state.step)?1:2;
    return `<aside class="sx-rail"><div class="sx-rail-intro"><span class="sx-orbit">${icon('sparkle')}</span><h3>Cuidado com<br>um porquê.</h3><p>Você traz o contexto.<br>A gente torna a escolha mais clara.</p></div><ol class="sx-progress" aria-label="Sua jornada">${['Entender você','Explicar as escolhas','Você decide'].map((t,i)=>`<li ${phase===i?'aria-current="step"':''} class="${i<=phase?'is-active':''}"><span>${i<phase?icon('check'):String(i+1).padStart(2,'0')}</span>${t}</li>`).join('')}</ol>${contextSummary()}<div class="sx-rail-bottom">${icon('lock-simple')}<p>Só nesta sessão.<br>Sem conta, envio de foto ou IA real.</p>${button('Meus dados','privacy','text')}</div></aside>`;
  }
  function render() {
    if(disposed)return;
    const views={welcome,context:questionView,review,processing,paused,scope,routine,source,comparison,cart,checkout,checkin,privacy,catalog};
    element.innerHTML=`<header class="sx-top"><a class="sx-wordmark" href="#inicio" data-action="home">skinboost<span>®</span></a><span class="sx-demo-label">EXPERIÊNCIA CONCEITUAL</span>${options.onClose?button(icon('x')+'<span class="sr-only">Fechar experiência</span>','close','icon'):''}</header><div class="sx-layout">${rail()}<section class="sx-main"><div class="sx-mobile-tools">${button(icon('lock-simple')+' Meus dados','privacy','text')}${state.photoName&&state.step!=='welcome'?photoChip():''}</div>${(views[state.step]||welcome)()}${state.error?`<p class="sx-error" role="alert">${esc(state.error)}</p>`:''}</section></div><div class="sx-live" role="status" aria-live="polite" data-live></div>`;
    requestAnimationFrame(()=>{if(!disposed){local('#dialog-title')?.focus({preventScroll:true});element.closest('dialog')?.scrollTo(0,0);element.closest('.composer-shell')?.scrollTo(0,0);}});
  }
  function welcome() {
    return `${title('UMA CONVERSA, UM COMEÇO','O que você quer<br>cuidar hoje?','Não precisa saber o nome de um ingrediente. Conte o que gostaria de entender ou mudar na sua rotina.')}<form data-form="intent" class="sx-composer"><label for="sx-intent">Seu pedido</label><textarea id="sx-intent" name="intent" maxlength="800" required placeholder="Ex.: quero começar com poucos passos, sem gastar muito.">${esc(state.context.intent)}</textarea>${photoChip()}<div class="sx-composer-tools">${attachment()}<button class="sx-send" type="submit" aria-label="Continuar com meu pedido">${icon('arrow-up')}</button></div></form><div class="sx-starters"><span class="sx-kicker">UM PONTO DE PARTIDA</span>${['Quero começar com poucos passos.','Quero aproveitar os produtos que já tenho.','Quero entender cada escolha antes de comprar.'].map(t=>button(esc(t)+icon('arrow-up-left'),'preset','suggestion',`data-value="${esc(t)}"`)).join('')}</div>${hint('Você verá uma rotina ilustrativa, com razões e limites claros. Nenhuma análise clínica é feita.')}<div class="sx-bottom-links">${button('Explorar um exemplo preenchido '+icon('arrow-right'),'demo','text')}${button('Ver catálogo primeiro','catalog','text')}</div>`;
  }
  function photoChip() { return state.photoName?`<div class="sx-file sx-composer-file">${icon('file-image')}<span>${esc(state.photoName)}</span>${button(icon('x')+'<span class="sr-only">Remover foto</span>','remove-photo','icon')}</div><p class="sx-footnote">Arquivo só nesta sessão. Sem envio ou análise.</p>`:''; }
  function attachment() { return `<label class="sx-attach">${icon('camera')} ${state.photoName?'Trocar foto':'Adicionar foto'}<span>opcional</span><input class="sr-only" type="file" data-photo accept="image/jpeg,image/png,image/webp"></label>`; }
  function conversationTrail() {
    return `<details class="sx-conversation"><summary>${icon('chat-circle-text')} Seu pedido e suas respostas ${icon('caret-down')}</summary><div class="sx-user-message"><span>VOCÊ</span>${esc(state.context.intent)}</div>${questions.filter(q=>state.context[q.key]).map(q=>`<div class="sx-answer-row"><span>${esc(q.title)}</span><strong>${esc(state.context[q.key])}</strong>${button('Editar','edit-field','text',`data-key="${q.key}"`)}</div>`).join('')}</details>`;
  }
  function questionView() {
    const q=questions[state.question];
    return `${conversationTrail()}${title(`SEU CONTEXTO · ${state.question+1} DE ${questions.length}`,q.title,q.description)}<div class="sx-chat-caption">${icon('sparkle')} SkinBoost <span>pergunta só o que falta</span></div><form data-form="question"><fieldset class="sx-options"><legend class="sr-only">${q.title}</legend>${q.choices.map(([value,label,description,glyph])=>`<label class="sx-option ${state.context[q.key]===value?'selected':''}"><input type="radio" name="answer" value="${esc(value)}" ${state.context[q.key]===value?'checked':''}>${icon(glyph)}<span><strong>${label}</strong><small>${description}</small></span><span class="sx-radio" aria-hidden="true"></span></label>`).join('')}</fieldset>${q.custom?`<label class="sx-field-label" for="sx-custom">${q.custom}</label><input class="sx-input" id="sx-custom" name="custom" ${q.inputmode?`inputmode="${q.inputmode}"`:''} maxlength="250" placeholder="${q.placeholder}" value="${!q.choices.some(c=>c[0]===state.context[q.key])?esc(state.context[q.key]):''}">`:''}<div class="sx-actions">${button(icon('arrow-left')+' Voltar','back-question','secondary')}<button type="submit" class="sx-button sx-primary">${state.returnStep?'Rever alteração':state.question===4?'Revisar meu contexto':'Continuar'} ${icon('arrow-right')}</button></div></form><p class="sx-footnote">Você pode voltar e mudar qualquer resposta antes de seguir.</p>`;
  }
  function review() {
    return `${title('ANTES DAS ESCOLHAS','Entendemos<br>seu ponto de partida?','Confira o que vai orientar este exemplo. Você mantém o controle da conversa.')}<div class="sx-review-context">${contextSummary()}</div>${hint(state.context.sensitivity==='Tenho sensibilidade ou restrições'?'Como você informou uma restrição, confira a composição e a orientação de um profissional antes de usar qualquer novo produto. Aqui, vamos apresentar funções, sem validar adequação.':'As escolhas consideram suas preferências e o catálogo conceitual. Ainda não validam fórmula, tolerância ou adequação à sua pele.')}<div class="sx-attachment-row">${attachment()}<span>${state.photoName?esc(state.photoName):'Nenhuma foto anexada'}</span></div><div class="sx-actions">${button('Editar meu pedido','edit-intent','secondary')}${button('Ver minha rotina '+icon('arrow-right'),'generate')}</div>`;
  }
  function processing() { return `${title('PREPARANDO SEU EXEMPLO','Transformando contexto<br>em escolhas.','Comparando as preferências informadas com as regras locais do catálogo demonstrativo.')}<div class="sx-processing">${icon('circles-three')}<span>Organizando a apresentação da rotina…</span></div>${button('Cancelar e manter respostas','cancel','secondary')}`; }
  function paused() { return `${title('VOCÊ ESTÁ NO CONTROLE','Suas respostas<br>continuam aqui.','O preparo foi interrompido. Retome quando quiser ou ajuste seu contexto.')}<div class="sx-actions">${button('Rever contexto','review','secondary')}${button('Retomar','generate')}</div>`; }
  function scope() { return `${title('UM LIMITE IMPORTANTE','Essa dúvida merece<br>um profissional.','Este exemplo organiza uma rotina cosmética. Não identifica doenças em fotos nem indica tratamento para sintomas.')}<div class="sx-user-message">${esc(state.context.intent)}</div>${hint('Podemos continuar explorando as funções dos produtos, sem transformar o seu relato em diagnóstico.')}<div class="sx-actions">${button('Reformular meu pedido','edit-intent','secondary')}${button('Conhecer o básico','basic')}</div>`; }
  function productCard(p,index) {
    return `<article class="sx-product"><div class="sx-product-top"><span class="sx-step-number">${String(index+1).padStart(2,'0')}</span><div><span class="sx-kicker">${esc(p.category)} · ${esc(p.volume)}</span><h3>${esc(p.name)}</h3></div><span class="sx-price">${money(p.price)}<small>valor fictício</small></span></div><p class="sx-reason"><strong>Por que aparece aqui</strong>${esc(p.reason||p.description)}</p><div class="sx-product-bottom"><span>${icon('info')} Catálogo conceitual</span>${button('Ver fonte e limites '+icon('arrow-up-right'),'source','text',`data-product="${p.id}"`)}</div></article>`;
  }
  function fitCards() {
    const count=questions.filter(q=>state.context[q.key]).length;
    return `<div class="sx-fit"><div><span>CONTEXTO DA CONVERSA</span><strong>${count} de 5 respostas</strong><p>Preferências declaradas por você.</p><div class="sx-meter" aria-hidden="true">${questions.map((_,i)=>`<i class="${i<count?'on':''}"></i>`).join('')}</div></div><div><span>ANÁLISE DA FOTO</span><strong>${state.photoName?'Referência anexada':'Sem foto, tudo bem'}</strong><p>${state.photoName?'Não analisada neste protótipo.':'A jornada não depende de imagem.'}</p></div></div>`;
  }
  function catalog() {
    return `${title('CATÁLOGO CONCEITUAL','Conheça a função.<br>Confira a fonte.','Você pode explorar cada item antes de decidir se quer montar uma rotina.')}<figure class="sx-family"><img src="/media/produtos-skinboost.png" alt="Embalagens conceituais SkinBoost Cleanse, Balance e Comfort"><figcaption>Imagens de produto conceitual · sem oferta de venda</figcaption></figure>${CATALOG.map(productCard).join('')}<div class="sx-actions">${button('Voltar à conversa','welcome','secondary')}${state.routine?button('Retomar minha rotina','routine'):''}</div>`;
  }
  function routine() {
    const r=state.routine;
    if(!r)return `${title('SUA ROTINA','Vamos começar<br>pelo contexto?','Suas preferências ajudam a construir um exemplo com sentido.')}${button('Começar conversa','welcome')}`;
    return `${title(`SUA ROTINA · VERSÃO ${state.revision+1}`,r.products.length?'Menos adivinhação.<br>Mais clareza.':'Aproveite o que<br>você já tem.',r.explanation||'Um ponto de partida explicado. Você pode mudar o ritmo, o orçamento ou o que já usa.')}${fitCards()}<figure class="sx-family"><img src="/media/produtos-skinboost.png" alt="Família de embalagens conceituais SkinBoost"><figcaption>Os itens abaixo são conceitos de produto. As razões consideram suas respostas.</figcaption></figure><div class="sx-artifact-label">${icon('list-checks')} Sua rotina está pronta para revisar <span>EXEMPLO</span></div>${r.products.map(productCard).join('')}${!r.products.length?hint('Você pode explorar o catálogo e conferir as informações que ainda faltam. Nenhuma compra é necessária para continuar.'):''}<div class="sx-cost"><div><span>Total ilustrativo</span><strong>${money(r.subtotal)}</strong><small>${r.withinBudget?'Dentro do limite informado, quando definido.':'O limite informado não comporta uma nova compra neste exemplo.'}</small></div>${button('Comparar valores '+icon('arrow-right'),'comparison','text')}</div>${priceNote()}<details class="sx-disclosure"><summary>Quando posso esperar resultados? ${icon('plus')}</summary><p>Não há prazo validado para esta linha conceitual. Prometer rejuvenescimento a partir de uma foto criaria uma certeza que não temos. Uma versão comercial deve exibir a evidência específica do produto, a população estudada e os limites do resultado.</p></details><div class="sx-refine"><span class="sx-kicker">AJUSTE SÓ O QUE PRECISAR</span><div>${button('Menos passos','adjust-few','chip')}${button('Rever orçamento','edit-field','chip','data-key="budget"')}${button('Já uso um desses','edit-field','chip','data-key="existing"')}</div></div><div class="sx-actions">${button('Copiar minha rotina '+icon('copy'),'copy','secondary')}${r.products.length?button('Revisar produtos '+icon('arrow-right'),'cart'):button('Explorar catálogo','catalog')}</div><div class="sx-bottom-links">${button('Fazer um check-in','checkin','text')}${button('Rever meu pedido','edit-intent','text')}</div>${state.checkin?`<div class="sx-checkin-saved">${icon('check-circle')} Check-in: ${esc(state.checkin.status)}${state.checkin.note?`<p>${esc(state.checkin.note)}</p>`:''}</div>`:''}`;
  }
  function source() {
    const p=CATALOG.find(p=>p.id===state.sourceId)||CATALOG[0];
    return `${title('ORIGEM DA ESCOLHA',esc(p.name),'Antes de confiar, você precisa conseguir conferir.')}<div class="sx-evidence"><span class="sx-status">${icon('info')} CONCEITO · AINDA NÃO VALIDADO</span><h3>${esc(p.source?.title||'Catálogo conceitual SkinBoost')}</h3><p>${esc(p.source?.detail||p.description)}</p><dl><div><dt>O que sabemos</dt><dd>Nome, função proposta e volume da embalagem conceitual.</dd></div><div><dt>O que orientou a seleção</dt><dd>${esc(state.routine?.products.find(x=>x.id===p.id)?.reason||'Você abriu este item do catálogo para conhecer sua função proposta.')}</dd></div><div><dt>O que ainda falta</dt><dd>Fórmula, ingredientes, tolerância, instruções de uso, evidência de eficácia e preço comercial validado.</dd></div><div><dt>O que a foto não informa</dt><dd>Neste protótipo, nenhum conteúdo da foto é lido ou analisado.</dd></div></dl></div>${hint('A fonte aqui é a especificação do protótipo. Não é um estudo clínico nem uma comprovação de eficácia.')}<a class="sx-source-link" href="/brandbook.html" target="_blank" rel="noopener">Consultar o brandbook do projeto ${icon('arrow-up-right')}</a><div class="sx-actions">${button(icon('arrow-left')+' Voltar à rotina','routine','secondary')}${button('Explorar este item no catálogo','catalog','text')}</div>`;
  }
  function costBars(r) {
    const max=Math.max(r.comparisonTotal,r.subtotal,1);
    return `<div class="sx-bars" role="img" aria-label="Comparação ilustrativa. Referência ${money(r.comparisonTotal)}. Sua seleção ${money(r.subtotal)}.">${[['Referência fictícia',r.comparisonTotal],['Sua seleção fictícia',r.subtotal]].map(([label,value])=>`<div><div class="sx-bar-label"><span>${label}</span><strong>${money(value)}</strong></div><div class="sx-bar-track"><span style="width:${value/max*100}%"></span></div></div>`).join('')}</div>`;
  }
  function comparison() {
    const r=state.routine;
    return `${title('ECONOMIA QUE VOCÊ PODE CONFERIR','A conta fica<br>à vista.','Uma comparação didática entre os mesmos itens e volumes, com duas tabelas de preços fictícias. Não representa economia real no mercado.')}${costBars(r)}<div class="sx-table-wrap"><table class="sx-table"><caption>Comparação por embalagem · cenário fictício</caption><thead><tr><th>Produto</th><th>Referência fictícia</th><th>SkinBoost fictício</th></tr></thead><tbody>${r.products.map(p=>`<tr><th>${esc(p.name)}<small>${esc(p.volume)}</small></th><td>${money(p.referencePrice)}</td><td>${money(p.price)}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total</th><td>${money(r.comparisonTotal)}</td><td>${money(r.subtotal)}</td></tr></tfoot></table></div><div class="sx-saving"><span>Diferença neste cenário</span><strong>${money(r.savings)}</strong><p>Referência fictícia − total fictício da sua seleção.</p></div>${hint('Não extrapolamos para economia mensal: a duração das embalagens e a frequência de uso ainda não foram validadas.')}<div class="sx-actions">${button('Voltar à rotina','routine','secondary')}${r.products.length?button('Revisar produtos','cart'):''}</div>`;
  }
  function cart() {
    const r=state.routine;
    const selected=r.products.filter(p=>state.selected.includes(p.id));
    return `${title('ANTES DE CONTINUAR','Só o que faz<br>sentido para você.','Revise os itens. Nada é adicionado a uma compra sem a sua escolha.')}<div class="sx-cart-products">${r.products.map(p=>`<label class="sx-cart-item"><input type="checkbox" data-cart-item value="${p.id}" ${state.selected.includes(p.id)?'checked':''}><span><strong>${esc(p.name)}</strong><small>${esc(p.category)} · ${esc(p.volume)}</small></span><strong>${money(p.price)}</strong></label>`).join('')}</div><div class="sx-order-total"><span>Total ilustrativo</span><strong data-cart-total>${money(selected.reduce((n,p)=>n+p.price,0))}</strong></div>${priceNote()}${hint('Este checkout é uma simulação. Nenhum dado de pagamento será solicitado e não haverá cobrança.')}<div class="sx-actions">${button('Voltar à rotina','routine','secondary')}${button('Ir para checkout demonstrativo '+icon('arrow-right'),'checkout','primary',selected.length?'':'disabled')}</div>`;
  }
  function checkout() {
    const selected=state.routine.products.filter(p=>state.selected.includes(p.id));
    return `${title('CHECKOUT · DEMONSTRAÇÃO','Uma escolha<br>consciente.','Este é o ponto de passagem para o checkout de uma futura loja. Seu pedido não foi enviado.')}<div class="sx-checkout-visual">${icon('bag')}<span>Revisado por você</span><h3>${selected.length} ${selected.length===1?'produto':'produtos'} na seleção</h3><p>${selected.map(p=>esc(p.name)).join(' + ')||'Nenhum produto selecionado'}</p><strong>${money(selected.reduce((n,p)=>n+p.price,0))}</strong><small>Total fictício · sem pagamento</small></div>${hint('Para uma compra real, seriam necessários catálogo e preços verificados, disponibilidade e uma integração de checkout. Nenhuma dessas informações é simulada como real aqui.')}<div class="sx-actions">${button('Rever seleção','cart','secondary')}${button('Guardar nesta sessão '+icon('check'),'finish')}</div>`;
  }
  function checkin() {
    return `${title('CONTINUIDADE','Como o cuidado<br>cabe na sua vida?','Registre sua experiência para revisar o próximo passo. Este registro fica só na sessão aberta.')}<form data-form="checkin"><fieldset class="sx-options"><legend class="sr-only">Como foi sua experiência?</legend>${['Consegui manter','Preciso simplificar','Quero rever o custo','Ainda não comecei'].map(v=>`<label class="sx-option"><input type="radio" name="status" value="${v}" ${state.checkin?.status===v?'checked':''}><span><strong>${v}</strong></span><span class="sx-radio" aria-hidden="true"></span></label>`).join('')}</fieldset><label class="sx-field-label" for="sx-note">Quer contar algo mais? <span>Opcional</span></label><textarea class="sx-input" id="sx-note" name="note" maxlength="600" placeholder="O que facilitou ou dificultou a sua rotina?">${esc(state.draft||state.checkin?.note||'')}</textarea><div class="sx-actions">${button('Voltar à rotina','routine','secondary')}<button type="submit" class="sx-button sx-primary">Guardar check-in ${icon('check')}</button></div></form>`;
  }
  function privacy() { return `${title('SEUS DADOS, SUAS ESCOLHAS','Você decide<br>o que fica aqui.','Tudo desta experiência permanece na memória desta aba. Recarregar ou fechar a página apaga as respostas.')}<div class="sx-evidence"><dl><div><dt>Texto e preferências</dt><dd>Usados pelas regras locais para compor o exemplo.</dd></div><div><dt>Foto opcional</dt><dd>Somente o nome aparece. O arquivo não é enviado nem analisado.</dd></div><div><dt>Eventos da jornada</dt><dd>Somente contadores locais, sem texto livre, nome de arquivo ou imagem. Não são enviados a serviços de análise.</dd></div></dl></div>${button('Apagar minhas respostas e recomeçar','reset','secondary')}<div class="sx-actions">${button('Voltar','privacy-back','text')}</div>`; }

  function generate() {
    if(isMedicalRequest(state.context.intent)){go('scope');return;}
    go('processing'); log('routine_requested');
    clearTimeout(timer);
    // Yield once so the processing state is paintable; all rules run locally.
    timer=setTimeout(()=>{
      if(disposed||state.step!=='processing')return;
      try { state.routine=buildRoutine(state.context); state.selected=state.routine.products.map(p=>p.id); state.orderReviewed=false; state.returnStep='';log('routine_ready',{count:state.selected.length});go('routine'); }
      catch { state.step='paused';state.error='Não foi possível organizar o exemplo. Suas respostas estão preservadas. Tente retomar.';render(); }
    },350);
  }
  function editField(key) { const i=questions.findIndex(q=>q.key===key);if(i<0)return;state.returnStep=state.routine?'routine':'review';go('context',{question:i}); }
  function copyRoutine() {
    const text=`Minha rotina SkinBoost — demonstração\n${state.routine.products.map((p,i)=>`${i+1}. ${p.name}: ${p.reason}`).join('\n')}\nTotal fictício: ${money(state.routine.subtotal)}\nProdutos conceituais, sem validação clínica ou oferta de venda.`;
    if(!navigator.clipboard){notify('Não foi possível copiar neste navegador. Selecione o texto da rotina.');return;}
    navigator.clipboard.writeText(text).then(()=>notify('Rotina copiada. Os limites da demonstração foram incluídos.')).catch(()=>notify('Não foi possível copiar. Selecione e copie as informações da rotina.'));
  }
  function actionHandler(e) {
    const target=e.target.closest('[data-action]');if(!target||!element.contains(target))return;
    e.preventDefault(); const action=target.dataset.action;
    switch(action) {
      case 'close': clearTimeout(timer);if(state.step==='processing')state.step='paused';options.onClose?.();break;
      case 'home': case 'welcome': go('welcome');break;
      case 'preset': state.context.intent=target.dataset.value;render();local('#sx-intent')?.focus();break;
      case 'demo':seed();state.revision=0;go('routine');log('example_opened');break;
      case 'catalog': go('catalog');break;
      case 'edit-all': state.returnStep=state.routine?'routine':'review';go('review');break;
      case 'edit-field':editField(target.dataset.key);break;
      case 'edit-intent': go('welcome');break;
      case 'back-question': if(state.returnStep)go(state.returnStep);else if(state.question>0)go('context',{question:state.question-1});else go('welcome');break;
      case 'generate':generate();break;
      case 'cancel':clearTimeout(timer);go('paused');log('routine_cancelled');break;
      case 'basic':state.context.intent='Quero conhecer as funções básicas de uma rotina cosmética.';go('context',{question:0});break;
      case 'source': state.sourceId=target.dataset.product;go('source');log('source_opened',{productId:state.sourceId});break;
      case 'adjust-few':state.context.approach='Poucos passos';state.revision++;go('review');break;
      case 'comparison':go('comparison');log('comparison_opened');break;
      case 'cart':go('cart');log('cart_reviewed');break;
      case 'checkout':if(state.selected.length){go('checkout');log('checkout_demo_opened',{count:state.selected.length});}break;
      case 'finish':state.orderReviewed=true;go('routine');notify('Sua seleção está guardada nesta sessão. Nenhuma compra foi realizada.');log('selection_saved');break;
      case 'copy':copyRoutine();break;
      case 'checkin':if(!state.routine){go('welcome');notify('Comece por uma rotina para fazer o check-in.');}else go('checkin');break;
      case 'remove-photo':state.error='';state.photoName='';options.onPhotoChange?.('');render();notify('Foto removida. Suas respostas foram mantidas.');break;
      case 'privacy':state.previousStep=state.step;go('privacy');break;
      case 'privacy-back':go(state.previousStep||'welcome');break;
      case 'reset':Object.assign(state,createExperienceState());options.onPhotoChange?.('');options.onReset?.();render();notify('Respostas, foto e registros apagados desta sessão.');break;
      case 'review':case 'routine':go(action);break;
    }
  }
  function submitHandler(e) {
    const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();const data=new FormData(form);
    if(form.dataset.form==='intent'){
      const text=String(data.get('intent')||'').trim();if(!text){state.error='Conte o que gostaria de entender ou escolha um ponto de partida.';render();return;}
      state.context.intent=text;log('conversation_started');if(isMedicalRequest(text)){go('scope');return;}
      const missing=questions.findIndex(q=>!state.context[q.key]);go(missing<0?'review':'context',{question:Math.max(0,missing)});
    }
    if(form.dataset.form==='question'){
      const q=questions[state.question], value=String(data.get('custom')||data.get('answer')||'').trim();
      if(!value){state.error='Escolha uma opção'+(q.custom?' ou escreva sua resposta.':'.');render();return;}
      if(q.key==='budget'&&!q.choices.some(c=>c[0]===value)&&!/^\s*(R\$\s*)?\d+([.,]\d{1,2})?\s*$/.test(value)){state.error='Informe um valor em reais, como 90 ou R$ 90,50, ou escolha uma opção.';render();return;}
      state.context[q.key]=value;
      if(state.returnStep){state.revision++;go('review');}
      else if(state.question<questions.length-1)go('context',{question:state.question+1});else go('review');
    }
    if(form.dataset.form==='checkin'){
      const status=data.get('status');if(!status){state.error='Escolha como foi sua experiência para guardar o check-in.';render();return;}
      state.checkin={status,note:String(data.get('note')||'').trim()};log('checkin_saved');
      if(status==='Preciso simplificar'){state.context.approach='Poucos passos';state.revision++;go('review');}
      else if(status==='Quero rever o custo')editField('budget');else {go('routine');notify('Check-in guardado nesta sessão.');}
    }
  }
  function changeHandler(e) {
    if(e.target.matches('[data-photo]')){
      const file=e.target.files?.[0];if(!file)return;const error=validatePhoto(file);
      if(error){e.target.value='';state.error=error;render();return;}
      state.error='';state.photoName=file.name;options.onPhotoChange?.(file.name);log('photo_attached');render();notify('Foto anexada. Nesta demonstração, a imagem não é enviada ou analisada.');
    }
    if(e.target.matches('input[name="answer"]')){if(local('#sx-custom'))local('#sx-custom').value='';all('.sx-option').forEach(el=>el.classList.toggle('selected',el.querySelector('input')?.checked));}
    if(e.target.matches('[data-cart-item]')){
      state.selected=all('[data-cart-item]:checked').map(el=>el.value);
      local('[data-cart-total]').textContent=money(state.routine.products.filter(p=>state.selected.includes(p.id)).reduce((n,p)=>n+p.price,0));
      local('[data-action="checkout"]').disabled=!state.selected.length;
    }
  }
  function inputHandler(e) {
    if(e.target.matches('#sx-intent'))state.context.intent=e.target.value;
    if(e.target.matches('#sx-custom')){state.context[questions[state.question].key]=e.target.value;all('input[name="answer"]').forEach(el=>el.checked=false);}
    if(e.target.matches('#sx-note'))state.draft=e.target.value;
  }
  element.addEventListener('input',inputHandler);
  element.addEventListener('click',actionHandler);element.addEventListener('submit',submitHandler);element.addEventListener('change',changeHandler);
  render();
  return {state,show:go,destroy(){disposed=true;clearTimeout(timer);clearTimeout(noticeTimer);element.removeEventListener('input',inputHandler);element.removeEventListener('click',actionHandler);element.removeEventListener('submit',submitHandler);element.removeEventListener('change',changeHandler);element.innerHTML='';element.classList.remove('sb-experience');}};
}
