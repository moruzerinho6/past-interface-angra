const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron')
const puppeteer = require('puppeteer');
const Docxtemplater = require('docxtemplater')
const PizZip = require('pizzip')
const findChrome = require('chrome-finder')
const path = require('path')
const { formatDistance } = require('date-fns')
const { ptBR } = require('date-fns/locale')
const fs = require('fs');
const dotenv = require('dotenv');
const chromePath = findChrome()
const config = require(app.isPackaged ? '../../config.json' : './config.json')
let appWin = null
let progressBar = 0

const createWindow = () => {
    const win = new BrowserWindow({
        width: 400,
        height: 480,
        autoHideMenuBar: true,
        webPreferences: {
            preload: __dirname + '/preload.js'
        },
        resizable: false
    })

    win.loadFile('index.html')

    setInterval(() => {
        if (progressBar !== 0) {
            win.setProgressBar(progressBar);
        } else {
            win.setProgressBar(0)
        }
    }, 2000)

    appWin = win
}
const content = fs.readFileSync(
    __dirname + "/modeloOS.docx",
    "binary"
)
dotenv.config({ path: './.env' });

const glpiToJSON = async (options) => {
    const browser = await puppeteer.launch({
        headless: !options.showOperations, // Set to false if you want to see the browser
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: chromePath, // Use the path to the Chrome executable
        defaultViewport: { width: 1920, height: 1080 } // Uncomment if you want to set a specific viewport size
    });
    const page = await browser.newPage();
    await page.setCacheEnabled(false)
    // Navigate to a URL
    await page.goto(config.glpiURL);
    
    const loginElem = await page.waitForSelector('#login_name'); // Wait for the login form to appear
    const passwordElem = await page.waitForSelector('#login_password');

    appWin.title = 'GLPI - Logando...'

    await loginElem.type(process.env.LOGIN); // Use environment variable for login
    await passwordElem.type(process.env.PASSWORD); // Use environment variable for password

    await page.click('[name="submit"]'); // Click the login button

    await page.waitForSelector('#ui-id-4') // Wait for main page to load.

    await page.goto(`${config.glpiURL}/front/ticket.php`); // Navigate to the ticket page

    await page.waitForSelector('[name="criteria[0][value]"'); // Wait for main filter to show.

    await page.select('[name="criteria[0][value]"]', 'all'); // Select 'Todos' from the dropdown

    appWin.title = 'GLPI - Aplicando Filtros...'
    const updateFilterButton = await page.waitForSelector('input[type="submit"]'); // Wait for the update filter button

    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for 1 second

    await updateFilterButton.click(); // Click the update filter button

    await new Promise(resolve => setTimeout(resolve, 3000)) // Wait for 3 second

    await page.waitForSelector('[name="glpilist_limit"]'); // Wait for the tickets to load

    await page.select('[name="glpilist_limit"]', options.ticketLimit); // Select '500' from the dropdown

    await new Promise(resolve => setTimeout(resolve, 7000)) // Wait for 7 seconds to ensure all tickets are loaded

    const ticketListFilters = await page.waitForSelector('.tab_cadrehov')

    await ticketListFilters.evaluate(tr => {
        tr.children[0].children[0].children[13].children[0].click(); // Filter by oldest tickets
    })

    await new Promise(resolve => setTimeout(resolve, 7000)) // Wait for 7 seconds to ensure all tickets are loaded

    const ticketListFiltersUpdated = await page.waitForSelector('.tab_cadrehov')

    await ticketListFiltersUpdated.evaluate(tr => {
        tr.children[0].children[0].children[13].children[0].click(); // Filter by newest tickets
    })

    await new Promise(resolve => setTimeout(resolve, 7000)) // Wait for 7 seconds to ensure all tickets are loaded

    const ticketListBlock = await page.waitForSelector('.tab_cadrehov')

    appWin.title = 'GLPI - Coletando Chamados...'
    const ticketsEvaluated = await ticketListBlock.evaluate(async tr => {
        const tbody = tr.children[1]
        const ticketsLength = tbody.children.length - 2;
        const tickets = [];

        for (let i = 0; i < ticketsLength; i++) {
            const ticketBlock = tbody.children[i];
            const ticketId = ticketBlock.children[1].innerText
            const tickedTitle = ticketBlock.children[2].innerText
            const ticketStatus = ticketBlock.children[3].innerText
            const ticketSector = ticketBlock.children[4].innerText
            const ticketDescriptionPreview = ticketBlock.children[5].innerText
            const ticketCreator = ticketBlock.children[6].innerText
            const ticketAssignedWorker = ticketBlock.children[7].innerText
            const ticketCreatedAt = ticketBlock.children[8].innerText
            const ticketClosedAt = ticketBlock.children[9].innerText
            const ticketCategory = ticketBlock.children[10].innerText
            const ticketGroup = ticketBlock.children[11].innerText
            const ticketLastEditedBy = ticketBlock.children[12].innerText
            const ticketLastEditedAt = ticketBlock.children[13].innerText

            tickets.push({
                ticketId,
                tickedTitle,
                ticketStatus,
                ticketSector,
                ticketDescriptionPreview,
                ticketDescription: '',
                ticketSolution: '',
                ticketCreator,
                ticketAssignedWorker,
                ticketCreatedAt,
                ticketClosedAt,
                ticketCategory,
                ticketGroup,
                ticketLastEditedBy,
                ticketLastEditedAt
            });
        }

        return tickets;
    })

    const pLimit = require('p-limit');
    const limit = pLimit.default(4);

    await Promise.all(
        ticketsEvaluated.map(ticket =>
            limit(async () => {
                const ticketPage = await browser.newPage();
                appWin.title = `GLPI - Acessando Chamado ${ticket.ticketId}...`
                const ticketPageNavigation = await ticketPage.goto(`${config.glpiURL}/front/ticket.form.php?id=${ticket.ticketId}`).catch((err) => {
                    console.error(`Error navigating to ticket page for ticket ID ${ticket.ticketId}:`, err);
                    return {
                        status: () => {
                            return 500
                        }
                    };
                });

                ticketPageNavigation.status();

                if (ticketPageNavigation.status() !== 200) {
                    console.error(`Failed to load ticket page for ticket ID ${ticket.ticketId}. Status: ${ticketPageNavigation.status()}`);
                    await ticketPage.close();
                    return;
                }

                const ticketIssueDiv = await ticketPage.waitForSelector('[class="h_content ITILContent"]').catch((err) => {
                    console.error(`Error finding ticket issue div for ticket ID ${ticket.ticketId}:`, err);
                    return null;
                });

                if (!ticketIssueDiv) {
                    console.error(`Ticket issue div not found for ticket ID ${ticket.ticketId}.`);
                    await ticketPage.close();
                    return;
                }

                const ticketDescription = await ticketIssueDiv.evaluate(div => div.children[0].children[2].innerText);
                let ticketSolution = '';

                if (ticket.ticketStatus.includes('Solucionado') || ticket.tickedTitle.includes('Fechado')) {
                    const solutionNotApproved = await ticketPage.waitForSelector('[class="h_content Solution waiting"]').catch((err) => {
                        return null
                    });
                    let solutionApproved = null;
                    if (!solutionNotApproved) {
                        solutionApproved = await ticketPage.waitForSelector('[class="h_content Solution accepted"]').catch((err) => {
                            return null
                        });
                    }

                    let ticketSolutionDiv = solutionNotApproved || solutionApproved;

                    if (!ticketSolutionDiv) {
                        console.log(`Ticket ${ticket.ticketId} has no solution.`);
                    } else {
                        if (ticketSolutionDiv === solutionNotApproved) {
                            ticketSolution = await ticketSolutionDiv.evaluate(div => div.children[3].children[1].innerText);
                        } else {
                            ticketSolution = await ticketSolutionDiv.evaluate(div => div.children[1].children[1].innerText);
                        }
                    }
                }

                ticket.ticketDescription = ticketDescription;
                ticket.ticketSolution = ticketSolution;

                await ticketPage.close();
            })
        )
    );

    const inObject = {
        tickets: ticketsEvaluated,
        date: new Date().toISOString()
    }

    appWin.title = 'GLPI - Salvando Chamados...'
    const jsonContent = JSON.stringify(inObject, null, 2);
    fs.writeFileSync('tickets.json', jsonContent, 'utf8');
    console.log('Tickets data saved to tickets.json');
    await browser.close();
}

const jsonToOS = async (options) => {
    appWin.title = 'OS - Carregando Chamados de Angra...'
    const tickets = JSON.parse(fs.readFileSync('./tickets.json', 'utf8'));
    const ticketsArr = tickets.tickets
    const angraTickets = ticketsArr.filter(ticket => ticket.ticketSector.includes("Angra dos Reis"))

    const month = options.month || '05'
    const year = options.year || '2025'
    const dateToCollect = `${month}-${year}`

    appWin.title = `OS - Carregando Chamados de ${dateToCollect}...`
    const ticketsFromDate = angraTickets.filter(ticket => ticket.ticketCreatedAt.includes(dateToCollect))

    if (ticketsFromDate.length === 0) {
        dialog.showErrorBox('Nenhum Chamado Encontrado', `Nenhum chamado encontrado para o mês ${month} de ${year}.`);
        return 0;
    }

    const parseToDate = str => {
        const [date, time] = str.split(' ');
        const [day, month, year] = date.split('-').map(Number);
        const [hour = 0, min = 0] = (time || '00:00').split(':').map(Number);
        return new Date(year, month - 1, day, hour, min);
    }

    for (let i = 0; i < ticketsFromDate.length; i++) {
        const zip = new PizZip(content)
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true
        })
        const ticket = ticketsFromDate[i]
        const createdAt = parseToDate(ticket.ticketCreatedAt)
        const closedAt = parseToDate(ticket.ticketClosedAt || ticket.ticketLastEditedAt)
        const distance = ticket.ticketClosedAt || ticket.ticketLastEditedAt ? formatDistance(createdAt, closedAt, {
            locale: ptBR,
            addSuffix: false
        }) : 'Em aberto'
        const currentDate = new Date()
        // Generate string from date with the format 'DD de Month de YYYY'
        const formattedDate = `${currentDate.getDate()} de ${currentDate.toLocaleString('pt-BR', { month: 'long' })} de ${currentDate.getFullYear()}`

        appWin.title = `OS - Gerando OS para o Chamado ${ticket.ticketId}...`
        try {
            doc.render({
                osnumber: `GLPI-${ticket.ticketId}`,
                date: `${ticket.ticketCreatedAt.split(' ')[0].replaceAll('-', '/')}`,
                serviceNature: 'Atendimento',
                city: 'Angra dos Reis',
                oscaller: ticket.ticketCreator.trim(),
                place: ticket.ticketSector.includes(' > ') ? ticket.ticketSector.split(' > ')[1] : 'Projeto Angra',
                address: '',
                ostitle: ticket.tickedTitle,
                osdescription: ticket.ticketDescriptionPreview.includes('(...)') ? ticket.ticketDescription : ticket.ticketDescriptionPreview,
                solutionTechnician: ticket.ticketAssignedWorker.trim() || '',
                solutionDescription: ticket.ticketSolution || 'O problema foi resolvido como requisitado.',
                pendingTechnician: '',
                pendingDescription: '',
                activityTime: distance || '',
                documentCity: 'Angra dos Reis',
                formattedDate
            })

            const buffer = doc.getZip().generate({ type: "nodebuffer" })
            // Create output directory using the month and year constants (app.getPath('documents'))
            const outputDir = path.resolve(config.osPath, `${month}-${year}`)
            // const backupDir = path.resolve(__dirname, '../backup', `/${month}-${year}`)
            fs.mkdirSync(outputDir, { recursive: true })
            await new Promise(resolve => setTimeout(resolve, 1000))

            // fs.mkdirSync(backupDir, { recursive: true })
            // Write the file to the output directory
            fs.writeFileSync(outputDir + `/OS-${ticket.ticketId}.docx`, buffer)
            await new Promise(resolve => setTimeout(resolve, 1000))
            // fs.writeFileSync(backupDir + `/OS-${ticket.ticketId}.docx`, buffer)
        } catch (error) {
            console.error(JSON.stringify({ error: error }, null, 2))
            dialog.showErrorBox('Erro ao gerar OS', error.message || String(error))
            throw error
        }
    }
    appWin.title = 'Interface Angra'
}

app.whenReady().then(() => {
    ipcMain.handle('ping', () => 'pong')
    ipcMain.handle('genOS', async (event, options) => {

        if (!config.osPath) {
            return 'Caminho não definido! Por favor, defina o caminho padrão das OS antes de gerar.';
        }

        new Notification({
            title: 'Gerando OS',
            body: 'Aguarde, isso pode levar alguns minutos.'
        }).show();
        progressBar = 0.25;

        if (options.skipGLPI) {
            console.log('Skipping GLPI data collection');
        } else {
            await glpiToJSON(options);
            await new Promise(resolve => setTimeout(resolve, 9000))
        }
        
        progressBar = 0.75;

        const osCreationResult = await jsonToOS(options);

        if (osCreationResult === 0) {
            new Notification({
                title: 'Nenhum Chamado Encontrado',
                body: `Nenhum chamado encontrado para o mês ${options.month} de ${options.year}.`
            }).show();
            return `Nenhum chamado encontrado para o mês ${options.month} de ${options.year}.`;
        }
        progressBar = 0

        new Notification({
            title: 'OS Gerada',
            body: 'As OS foram geradas com sucesso.'
        }).show();

        return `OS geradas com sucesso!\n\nVerifique a pasta ${path.resolve(config.osPath, `${options.month}-${options.year}`)}.`;
    });
    ipcMain.handle('setPath', async () => {
        const result = await dialog.showOpenDialog(appWin, {
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        config.osPath = result.filePaths[0];
        new Notification({
            title: 'Caminho Definido',
            body: 'Caminho Padrão das OS foi definido.'
        }).show();

        fs.writeFileSync(path.join(__dirname, '../../config.json'), JSON.stringify(config, null, 2), 'utf8');
        return config.osPath;

    });
    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})