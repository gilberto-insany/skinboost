import { expect, fn } from 'storybook/test';
import { mountExperience } from '../experience.js';

// Each canvas has its own instance; removal destroys event listeners and timers.
const mounts = new Map();

function renderExperience(args) {
  const host = document.createElement('div');
  host.className = 'sb-story-host';
  host.dataset.initialStep = args.initialStep;
  let instance;
  let attached = false;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    instance?.destroy();
    mounts.delete(host);
  };
  const mount = () => {
    if (stopped || !host.isConnected) return;
    attached = true;
    instance = mountExperience(host, {
      initialStep: args.initialStep,
      onClose: () => {
        args.onClose();
        instance?.destroy();
        const closed = document.createElement('div');
        closed.className = 'sb-story-close';
        closed.innerHTML = '<h2>Experiência encerrada.</h2><p>Este é o mesmo callback de fechamento usado pela página.</p>';
        const reopen = document.createElement('button');
        reopen.className = 'pill dark';
        reopen.textContent = 'Reabrir exemplo';
        reopen.onclick = mount;
        closed.append(reopen);
        host.append(closed);
      },
    });
  };
  const observer = new MutationObserver(() => {
    if (!attached && host.isConnected) mount();
    else if (attached && !host.isConnected) stop();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  mounts.set(host, stop);
  requestAnimationFrame(() => { if (!attached) mount(); });
  return host;
}

export default {
  id: 'experiencia-jornada-guiada',
  title: 'Experiência/Jornada guiada',
  tags: ['autodocs'],
  args: { initialStep: 'welcome', onClose: fn() },
  argTypes: {
    initialStep: {
      control: 'select',
      options: ['welcome', 'context', 'routine', 'cart', 'checkout', 'checkin'],
      description: 'Estado inicial real. Estados posteriores usam uma fixture demonstrativa criada pelo próprio controlador.',
    },
    onClose: { table: { disable: true } },
  },
  render: renderExperience,
  beforeEach: () => () => {
    for (const [host, stop] of mounts) if (!host.isConnected) stop();
  },
  parameters: {
    docs: { story: { inline: false }, description: { component: 'mountExperience de src/experience.js, sem cópia de markup ou lógica. As respostas e o carrinho pertencem só a esta instância; não há pedido, pagamento ou análise real de pele.' } },
  },
};

export const BoasVindas = { name: '01 · Boas-vindas', args: { initialStep: 'welcome' } };
export const Contexto = { name: '02 · Contexto', args: { initialStep: 'context' } };
export const Rotina = { name: '03 · Rotina', args: { initialStep: 'routine' } };
export const Carrinho = { name: '04 · Carrinho', args: { initialStep: 'cart' } };
export const Checkout = { name: '05 · Checkout demonstrativo', args: { initialStep: 'checkout' } };
export const Checkin = { name: '06 · Check-in', args: { initialStep: 'checkin' } };

export const ContextoSemResposta = {
  name: 'Validação · resposta pendente',
  args: { initialStep: 'context' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /^Continuar/ }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Escolha uma opção');
  },
};

export const CarrinhoVazio = {
  name: 'Carrinho · seleção vazia',
  args: { initialStep: 'cart' },
  play: async ({ canvas, userEvent }) => {
    for (const checkbox of await canvas.findAllByRole('checkbox')) {
      if (checkbox.checked) await userEvent.click(checkbox);
    }
    await expect(canvas.getByRole('button', { name: /Ir para checkout demonstrativo/ })).toBeDisabled();
  },
};
