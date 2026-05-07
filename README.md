# angra-interface

Script com o proposito que coletar chamados do GLPI e transformar em documentos word relatando uma atividade, solução e confirmação da mesma com assinatura.

## Proposito

GLPI é uma plataforma que oferece dashboard e soluções de gerenciamento de TI, permitindo que usuários (funcionários qualquer da empresa) criem chamados que possam ser registrados, arquivados e solucionados por membros da equipe de TI da mesma empresa.

Porém nem todos concordam que essa é a forma de se arquivar, criar e solucionar problemas e esse script resolve um conflito que ocorreu nesse caso. Tal local decidiu que era melhor confirmar quais ações foram realizadas em uma folha A4, porém deixar de utilizar o GLPI iria criar questionamentos sobre o quão produtivo o setor de TI de fato está sendo.

Esse script foi criado para continuar utilizando a interface do GLPI porém poder transformar os chamados em uma folha A4 dizendo o problema, solução, tempo, local e outras informações importantes sobre o chamado.

## Utilização

> [!WARNING]
> Esse código é antigo, desatualizado e não recebe manutenção, requer acesso a plataforma myndware e não vai funcionar de nenhuma outra forma.
>
> Todo código e função mencionado deve ser visto dentro de src/index.js

### Configurações Necessárias

- Configurar o arquivo `.env` com *LOGIN* e *PASSWORD*.
- Configurar o arquivo `config.json` com *glpiURL*


Utilize os comandos para rodar ou buildar como electron.