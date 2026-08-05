const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Inicializa o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth()
});

// Configuração do Transporter do Nodemailer (SMTP)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Armazena o estado complexo de cada conversa
const userStates = {};

client.on('qr', (qr) => {
    console.log('Escaneie o QR Code abaixo com o seu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo pronto! Bot conectado ao WhatsApp com sucesso.');
});

// Função auxiliar para enviar o chamado de suporte por e-mail automaticamente
async function dispararChamado(msg, chatId, problemDescription) {
    const mailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.SUPPORT_DESTINATION_EMAIL,
        subject: `🚨 Novo Chamado de Suporte Técnico - WhatsApp (${chatId})`,
        text: `Você recebeu um novo chamado técnico via WhatsApp.\n\n` +
              `📱 Número do Cliente: ${chatId}\n\n` +
              `📝 Histórico/Problema relatado:\n${problemDescription}`
    };

    try {
        await transporter.sendMail(mailOptions);
        await msg.reply('✅ Chamado registrado e enviado com sucesso para a equipe de TI! Em breve um técnico dará continuidade ao seu atendimento.');
    } catch (error) {
        console.error('Erro ao enviar e-mail via SMTP:', error);
        await msg.reply('⚠️ Houve um erro ao enviar o e-mail do chamado. Por favor, contate o suporte diretamente.');
    }
}

client.on('message', async (msg) => {
    if (msg.fromMe || msg.from.endsWith('@g.us')) return;

    const chatId = msg.from;
    const text = msg.body.trim();
    const textLower = text.toLowerCase();

    // Comando universal para reiniciar/voltar ao menu
    if (textLower === 'menu' || textLower === 'sair') {
        userStates[chatId] = { step: 'MENU' };
        await msg.reply(
            `Olá! 👋 Sou o suporte técnico.\n\n` +
            `Como posso ajudar você hoje?\n\n` +
            `1️⃣ - Como posso recuperar minha senha?\n` +
            `2️⃣ - Minha internet não está funcionando. O que fazer?\n` +
            `3️⃣ - Como posso instalar um programa?\n` +
            `4️⃣ - Abrir um chamado direto\n\n` +
            `Digite o número da opção desejada:`
        );
        return;
    }

    if (!userStates[chatId]) {
        userStates[chatId] = { step: 'MENU' };
    }

    let state = userStates[chatId];

    // ==========================================
    // MENU PRINCIPAL
    // ==========================================
    if (state.step === 'MENU') {
        if (text === '1') {
            state.step = 'SENHA_LIGADO';
            state.history = 'Recuperação de Senha';
            await msg.reply('Seu computador está ligado?\n\nResponda *Sim* ou *Não*:');
        } else if (text === '2') {
            state.step = 'NET_LIGADO';
            state.history = 'Problema de Internet';
            await msg.reply('Seu computador está ligado?\n\nResponda *Sim* ou *Não*:');
        } else if (text === '3') {
            state.step = 'INSTAL_LIGADO';
            state.history = 'Instalação de Software';
            await msg.reply('Seu computador está ligado?\n\nResponda *Sim* ou *Não*:');
        } else if (text === '4') {
            state.step = 'SUPPORT_DIRECT_DESC';
            await msg.reply('🛠️ Vamos abrir um chamado. Por favor, descreva qual é o seu problema:');
        } else {
            await msg.reply(
                `Olá! 👋 Sou o suporte técnico.\n\n` +
                `Como posso ajudar você hoje?\n\n` +
                `1️⃣ - Como posso recuperar minha senha?\n` +
                `2️⃣ - Minha internet não está funcionando. O que fazer?\n` +
                `3️⃣ - Como posso instalar um programa?\n` +
                `4️⃣ - Abrir um chamado direto\n\n` +
                `Digite apenas o número da opção desejada:`
            );
        }
        return;
    }

    // Chamado Direto
    if (state.step === 'SUPPORT_DIRECT_DESC') {
        await dispararChamado(msg, chatId, text);
        userStates[chatId] = { step: 'MENU' };
        return;
    }

    // Função interna para lidar com verificação de chamado se o usuário falhou em um passo
    if (state.step.endsWith('_CHAMADO')) {
        if (textLower === 'sim') {
            await msg.reply('Perfeito! Em breve um técnico dará continuidade ao seu atendimento.');
        } else {
            await dispararChamado(msg, chatId, `Usuário não conseguiu resolver o problema na trilha: ${state.history || 'Suporte'}`);
        }
        userStates[chatId] = { step: 'MENU' };
        return;
    }

    // ==========================================
    // FLUXO 1: RECUPERAR SENHA
    // ==========================================
    if (state.step === 'SENHA_LIGADO') {
        if (textLower === 'sim') {
            state.step = 'SENHA_PASSO_1';
            await msg.reply('Perfeito! Para continuarmos, mantenha a tecla **Shift** pressionada e clique em **Reiniciar**.\n\nQuando concluir essa etapa, conseguiu realizar?\n\nSim\nNão');
        } else {
            state.step = 'SENHA_AGUARDA_LIGAR';
            await msg.reply('Sem problemas! Ligue o computador e, quando ele iniciar, responda **"Liguei"** para continuarmos.');
        }
        return;
    }

    if (state.step === 'SENHA_AGUARDA_LIGAR') {
        state.step = 'SENHA_PASSO_1';
        await msg.reply('Ótimo! Agora, mantenha a tecla **Shift** pressionada e clique em **Reiniciar**.\n\nConseguiu realizar esse passo?\n\nSim\nNão');
        return;
    }

    if (state.step === 'SENHA_PASSO_1') {
        if (textLower === 'sim') {
            state.step = 'SENHA_PASSO_2';
            await msg.reply('Perfeito! Agora, clique em:\n*Solução de Problemas* → *Opções Avançadas* → *Prompt de Comando*.\n\nConseguiu realizar esse passo?\n\nSim\nNão');
        } else {
            state.step = 'SENHA_PASSO_1_CHAMADO';
            await msg.reply('Sem problemas. Para que um técnico possa auxiliá-lo, será necessário abrir um chamado. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'SENHA_PASSO_2') {
        if (textLower === 'sim') {
            state.step = 'SENHA_PASSO_3';
            await msg.reply('Ótimo! Agora, no Prompt de Comando, execute os passos abaixo:\n1. Digite `C:` e pressione Enter.\n2. Digite `cd Windows` e pressione Enter.\n3. Digite `cd system32` e pressione Enter.\n\nConseguiu realizar esse passo?\n\nSim\nNão');
        } else {
            state.step = 'SENHA_PASSO_2_CHAMADO';
            await msg.reply('Sem problemas. Para que um técnico possa auxiliá-lo, será necessário abrir um chamado. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'SENHA_PASSO_3') {
        if (textLower === 'sim') {
            state.step = 'SENHA_PASSO_4';
            await msg.reply('Ótimo! Agora, no Prompt de Comando, copie e cole os comandos abaixo, um de cada vez, pressionando Enter após cada comando:\n\n1º comando:\n`ren utilman.exe utilman_backup.exe`\n\n2º comando:\n`ren cmd.exe utilman.exe`\n\nConseguiu realizar esse passo?\n\nSim\nNão');
        } else {
            state.step = 'SENHA_PASSO_3_CHAMADO';
            await msg.reply('Sem problemas. Para que um técnico possa auxiliá-lo, será necessário abrir um chamado. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'SENHA_PASSO_4') {
        if (textLower === 'sim') {
            state.step = 'SENHA_PASSO_5';
            await msg.reply('Perfeito! Já concluímos metade do processo.\n1. Na tela de login do Windows, clique no ícone de **Acessibilidade** para abrir o Prompt de Comando.\n2. Digite o comando e pressione Enter: `control userpasswords2`\n3. Na janela aberta, clique em **Redefinir Senha**, informe a nova senha e confirme em OK.\n\nConseguiu realizar esse passo?\n\nSim\nNão');
        } else {
            state.step = 'SENHA_PASSO_4_CHAMADO';
            await msg.reply('Sem problemas. Para que um técnico possa auxiliá-lo, será necessário abrir um chamado. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'SENHA_PASSO_5') {
        if (textLower === 'sim') {
            state.step = 'SENHA_PASSO_6';
            await msg.reply('Perfeito! Estamos na etapa final.\n1. Acesse novamente a tela de recuperação mantendo **Shift** e clicando em **Reiniciar**.\n2. Vá em *Solução de Problemas* → *Opções Avançadas* → *Prompt de Comando*.\n3. Digite:\n`C:` (Enter)\n`cd Windows` (Enter)\n`cd System32` (Enter)\n`ren utilman.exe cmd.exe` (Enter)\n`ren utilman_backup.exe utilman.exe` (Enter)\n\nConseguiu realizar esse passo?\n\nSim\nNão');
        } else {
            state.step = 'SENHA_PASSO_5_CHAMADO';
            await msg.reply('Sem problemas. Para que um técnico possa auxiliá-lo, será necessário abrir um chamado. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'SENHA_PASSO_6') {
        if (textLower === 'sim') {
            state.step = 'SENHA_PASSO_7';
            await msg.reply('Perfeito! Falta apenas a etapa final:\n1. Feche o Prompt de Comando.\n2. Clique em *Continuar* e depois em *Reiniciar*.\n3. Aguarde o Windows iniciar e faça login com a nova senha.\n\nConseguiu realizar esse passo?\n\nSim\nNão');
        } else {
            state.step = 'SENHA_PASSO_6_CHAMADO';
            await msg.reply('Sem problemas. Para que um técnico possa auxiliá-lo, será necessário abrir um chamado. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'SENHA_PASSO_7') {
        if (textLower === 'sim') {
            await msg.reply('🎉 Perfeito! A recuperação da sua senha foi concluída com sucesso.\n⚠️ Anote sua nova senha em um local seguro e não a compartilhe. Digite *menu* para voltar ao início.');
        } else {
            await dispararChamado(msg, chatId, 'Falha na última etapa de recuperação de senha do Windows.');
        }
        userStates[chatId] = { step: 'MENU' };
        return;
    }


    // ==========================================
    // FLUXO 2: PROBLEMA DE INTERNET
    // ==========================================
    if (state.step === 'NET_LIGADO') {
        if (textLower === 'sim') {
            state.step = 'NET_ESCOPO';
            await msg.reply('A internet não está funcionando apenas no seu computador ou em outros computadores também?\n\n1 - Apenas no meu computador\n2 - Em vários computadores');
        } else {
            state.step = 'NET_AGUARDA_LIGAR';
            await msg.reply('Sem problemas! Ligue o computador e, quando ele iniciar, responda **"Liguei"** para continuarmos.');
        }
        return;
    }

    if (state.step === 'NET_AGUARDA_LIGAR') {
        state.step = 'NET_ESCOPO';
        await msg.reply('A internet não está funcionando apenas no seu computador ou em outros computadores também?\n\n1 - Apenas no meu computador\n2 - Em vários computadores');
        return;
    }

    if (state.step === 'NET_ESCOPO') {
        if (text === '1' || textLower.includes('apenas')) {
            state.step = 'NET_PASSO_1';
            await msg.reply('Perfeito! Vamos continuar.\nAbra o *Este Computador*, clique com o botão direito nele e selecione **Gerenciar**.\n\nConseguiu realizar esse passo?\n\nSim\nNão');
        } else {
            await dispararChamado(msg, chatId, 'Problema de rede generalizado (vários computadores afetados na infraestrutura).');
            userStates[chatId] = { step: 'MENU' };
        }
        return;
    }

    if (state.step === 'NET_PASSO_1') {
        if (textLower === 'sim') {
            state.step = 'NET_PASSO_2';
            await msg.reply('Agora clique em:\n*Gerenciador de Dispositivos* → *Adaptadores de Rede*.\n\nConseguiu localizar Adaptadores de Rede?\n\nSim\nNão');
        } else {
            state.step = 'NET_PASSO_1_CHAMADO';
            await msg.reply('Sem problemas. Para que um técnico possa auxiliá-lo, será necessário abrir um chamado. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'NET_PASSO_2') {
        if (textLower === 'sim') {
            state.step = 'NET_PASSO_3';
            await msg.reply('Localize seu adaptador de rede (ex: Intel Ethernet Connection):\n1. Clique com o botão direito sobre ele.\n2. Selecione **Desabilitar dispositivo**.\n3. Aguarde alguns segundos.\n4. Clique novamente com o botão direito e selecione **Habilitar dispositivo**.\n\nA conexão com a internet voltou a funcionar?\n\nSim\nNão');
        } else {
            state.step = 'NET_PASSO_2_CHAMADO';
            await msg.reply('Sem problemas. Para que um técnico possa auxiliá-lo, será necessário abrir um chamado. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'NET_PASSO_3') {
        if (textLower === 'sim') {
            await msg.reply('🎉 Perfeito! O problema de conexão com a internet foi resolvido com sucesso. Se voltar a ocorrer, reinicie o computador. Digite *menu* para reiniciar.');
        } else {
            await dispararChamado(msg, chatId, 'Problema de internet persistente após redefinir o adaptador de rede.');
        }
        userStates[chatId] = { step: 'MENU' };
        return;
    }


    // ==========================================
    // FLUXO 3: INSTALAÇÃO DE SOFTWARE
    // ==========================================
    if (state.step === 'INSTAL_LIGADO') {
        if (textLower === 'sim') {
            state.step = 'INSTAL_QUAL';
            await msg.reply('Qual software você deseja instalar? (Ex: Google Chrome, Mozilla Firefox, Visual Studio Code)');
        } else {
            state.step = 'INSTAL_AGUARDA_LIGAR';
            await msg.reply('Sem problemas! Ligue o computador e, quando ele iniciar, responda **"Liguei"** para continuarmos.');
        }
        return;
    }

    if (state.step === 'INSTAL_AGUARDA_LIGAR') {
        state.step = 'INSTAL_QUAL';
        await msg.reply('Qual software você deseja instalar? (Ex: Google Chrome, Mozilla Firefox, Visual Studio Code)');
        return;
    }

    if (state.step === 'INSTAL_QUAL') {
        const softwareName = textLower;
        let comando = '';

        if (softwareName.includes('chrome')) {
            comando = 'winget install Google.Chrome';
        } else if (softwareName.includes('firefox')) {
            comando = 'winget install Mozilla.Firefox';
        } else if (softwareName.includes('visual studio code') || softwareName.includes('vscode')) {
            comando = 'winget install Microsoft.VisualStudioCode';
        } else {
            comando = `winget install ${text}`;
        }

        state.softwareComando = comando;
        state.step = 'INSTAL_CMD_ABRIR';

        await msg.reply(
            `Comando gerado para o software:\n\`${comando}\`\n\n` +
            `Instrução:\n` +
            `1. Abra a barra de pesquisa do Windows.\n` +
            `2. Digite *Prompt de Comando*.\n` +
            `3. Clique com o botão direito e selecione **Executar como administrador**.\n\n` +
            `Você conseguiu abrir o Prompt de Comando como administrador?\n\nSim\nNão`
        );
        return;
    }

    if (state.step === 'INSTAL_CMD_ABRIR') {
        if (textLower === 'sim') {
            state.step = 'INSTAL_EXECUTAR';
            await msg.reply(
                `Perfeito! Agora, copie o comando abaixo, cole no Prompt de Comando e pressione Enter:\n\n` +
                `\`${state.softwareComando}\`\n\n` +
                `Aguarde até que a instalação seja concluída.\n\n` +
                `A instalação foi concluída com sucesso?\n\nSim\nNão`
            );
        } else {
            state.step = 'INSTAL_CMD_CHAMADO';
            await msg.reply('Não tem problema. Será necessário o auxílio da equipe de TI. Você já abriu um chamado?\n\nSim\nNão');
        }
        return;
    }

    if (state.step === 'INSTAL_CMD_CHAMADO') {
        if (textLower === 'sim') {
            await msg.reply('Perfeito! Em breve um técnico dará continuidade ao seu atendimento.');
        } else {
            await dispararChamado(msg, chatId, 'Usuário não conseguiu abrir o Prompt como administrador para instalar software.');
        }
        userStates[chatId] = { step: 'MENU' };
        return;
    }

    if (state.step === 'INSTAL_EXECUTAR') {
        if (textLower === 'sim') {
            await msg.reply('🎉 Perfeito! O software foi instalado com sucesso e já pode ser utilizado. Digite *menu* para voltar ao início.');
        } else {
            await dispararChamado(msg, chatId, `Falha na instalação automática do software via comando: ${state.softwareComando}`);
        }
        userStates[chatId] = { step: 'MENU' };
        return;
    }

});

// Inicializa o cliente do WhatsApp Web
client.initialize();