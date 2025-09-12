import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import bip39 from 'bip39';
import ed25519 from 'ed25519-hd-key';
import { Keypair, TransactionBuilder, Operation, Asset, Account, FeeBumpTransaction, Memo   } from 'stellar-base';
import Sponsors from '../models/Sponsors.js';
import Passphrase from '../models/Passphrase.js';
import { Server, Keypair as StellarKeypair, TransactionBuilder as StellarTransactionBuilder, Operation as StellarOperation } from 'stellar-sdk';
import { storeLockedPi } from './modelfn.js';
import http from 'http';
import { sweepToMuxedWallet } from './fn2.js';


const NETWORK_PASSPHRASE = 'Pi Network';
export const PI_PUBLIC_ADDRESS = 'GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS';
// export const PI_PUBLIC_ADDRESS_GROUPED = ['MDFNWH6ZFJVHJDLBMNOUT35X4EEKQVJAO3ZDL4NL7VQJLC4PJOQFWAAAAAAH4VXAU5RHO', 'GDFZ5AXD7BANWNEWDVDJMZIB63OMBGNRKHNPAHBEZYYJ72ELIYUL4AQT'];
export const PI_PUBLIC_ADDRESS_GROUPED = ['MDFNWH6ZFJVHJDLBMNOUT35X4EEKQVJAO3ZDL4NL7VQJLC4PJOQFWAAAAAAH4VXAU5RHO', 'MDFNWH6ZFJVHJDLBMNOUT35X4EEKQVJAO3ZDL4NL7VQJLC4PJOQFWAAAAABDZ3SQSHJ26', 'GDFZ5AXD7BANWNEWDVDJMZIB63OMBGNRKHNPAHBEZYYJ72ELIYUL4AQT'];
export const PI_PUBLIC_MUXED_ADDRESS = 'MDFNWH6ZFJVHJDLBMNOUT35X4EEKQVJAO3ZDL4NL7VQJLC4PJOQFWAAAAABDZ3SQSHJ26';
// const PI_PUBLIC_ADDRESS = 'MDFNWH6ZFJVHJDLBMNOUT35X4EEKQVJAO3ZDL4NL7VQJLC4PJOQFWAAAAAAFBQ3VQWAZE';
const BOT_PHRASE = 'logic resemble wise decline unhappy all arrive engage motor shop borrow one rabbit pattern flight draw inflict wolf boy grit social black hand rate';
const SWEEP_FEE_PAYER_PHRASE = 'pudding inflict cash hawk climb remember orphan gather material stem expire loyal cousin benefit tube buzz love business tooth chimney ring screen rural thought';

const MAX_FLOOD_COUNT = 2;

export const firstFilteredSponsors = [
    // 'GDV2POWRVXELMWGWTTBBXIQSW3PKVWKGI43FD2NJURU6NTBK4QNZXEMJ',
    // 'GCQOB5VOELVMHW4BN4KFBI2WUR6IES7IT6FXSDR2PXCCDJDR2NEWO2KZ',
    // 'GAXXHWD25JCUMJCB5GEFOOIDJKCSABHAAECRJMUCUY6A7RHQBADDVMN5',
    // 'GDC2KOVXJAKY7XBRQQRY4DQQHTVFZDC36TDOXDKHKSLL6WFFCAIRTCNI',
    // 'GD7NYK2AW6EIDE2PA7WKCCEOIH5SECD6RXOWNOFYUOY7WQRRAKI74RVR',
    // 'GDWK7SSSWCLCD52SBFKDP4JPSZV6LKQ22UJR45HDZJQELH4YIQD3J67G',
    // 'GAV2WCOWF4GYUYKFBEFVBZ6XY44PW2MCWLZJ6OLGKHSXYYRC5TVAYLR7',
    // 'GCDLTGDKDZLHL5QQUWCX6L6SORWAVG43W4MIHQF5YD3M6N5UUO4E3WBH',
    // 'GAWPSXRXKWMPMCTBBLR47M5FBONIK4O4FE6LSOOX47LVTUV4WWP77BWV',
    // 'GCFJPFW4WIGQU3DAC325ZIE5YSWOJQETWAIANTQ6ORXMW7LJ43SYBTEC',
    'GBXSHWTBHLYGVE35QBZTTOLR2XUHWT3AFRIEFVIMRABS6XQLG2PV4ZSZ', //chris
    // 'GA5Z4P3LCTCT7UMKVUXMHQEGQBGUVPR65HZC4E64A4WT7KFGJ7XFITCE',
    // 'GBWQYU5IEKNP3FDT4UZEJLP3EHWZOCREHCPLDYGZFJRQA4B5YXBJ3Z6L', //...
    // 'GCAMEW67BHJYZK2P7NRUZGXF6AMRMXN6JJEM5KQFINBENESIUYREW2E4', //...
    // 'GANH64VUAIZDUHD3ROZUJF7ZDLPN3CWVAGJEQJIN7CDW5JETWK5PSXIC',
    // 'GBRYHLEWIIEGWANY53KIGPEHHLYPZIKLUHKQ3NOMT5MUXHDAHSWPHORD',
    // 'GCO4UOPYGFQRDFUQW3FXXZW7V7QGNEYIJPCIUGK6U7RTYMRJKH2TTN6V',
    // 'GC55GVZCFVDCCQ37MNNOT5NMLQASIUTCH4SD3YRTRD3HHT2D4G2WYC6U',
    // 'GDRZG5WXLQKF3B7AEPJTFF22VQPNJUBHDP5VHHC7TRYWSSNHZ6IT4UPJ',
    // 'GD2NLKMFUPKOU4TN52C66JLQAKYUMYBZWNZQUKUK6NI5JL6YAN5EZVDR',
    // 'GAWYUI6M75PYQ7E3X7OWMS2VKFQM3ESKIJSWLVIYXLJG64GOJS4T2IBX',
    // 'GCQSIIRFY66IMRQGHMRMFZJLP5TMG6BNJGOYXLZG3YJAHDZOYFFD76FQ',
    // 'GAQXQZWUZWMGJX72BJENUT6VSLU6PTLZJ5SYULGLN6F5SIYXYGZTC4ZX',
    // 'GCSWQMKTFIH24VBRPFVSAHMLQDQ6RTDVKMOBNZTXF4ASBLOOMRGBUQB6',
    // 'GCXJOVQWVRMQABCBLN35EWIVUQAZVONWBCI6JUWMP3HSVU23A64E4DSU',
    // 'GANBKBPDM4ZYYY6D4PTG4VNKIVPA2ZETWBAAFNYZCZUM2UNPID5OJQ6Z',
    // 'GADMCW5SE3EYD2ESMJ3GNM57L65IZS6ICLZ3KOC52V3OQCZPYCFOVUYM',
    // 'GBM5BYOWB3LUZM5NPGE5XDKAJJIUTREZIDVTQ2OPELMV5JYCVIJUMFLU',
    // 'GBOLXG6EDXYKOOOUEARXJUNBZOIE6CXAONQ2OZ74AEIP5XNW4A5L2556',
    // 'GACEG7XS3L5FORMV3RRLKW7X2R5NGTDPG6NGQG2VGLN7QE2ZTCUCCAOK',
    // 'GBRUCFW3L6UHX3RXNAT5VVQJHPRF4UOG4UEDTA6SIDVGIVWUTWGNRC6N',
    
    // 'GCA6VUL6D3X5DJGA2R6DS7RNKZFM3CZPAJOGO6IJEE4BPSMJ57W4C2WM',
    // 'GBZCDRUOO6MMP4XZTKBTTDCIFKLGHMJRXQCY4A4PKM5FTNAEE7DIJGNX',
    // 'GAR7T3F7VIQH2NJYQLQDOU5VJCBIGDAHXUVWV7F6HUNLLMZW2ALR3775',
    // 'GCZXDDHYTD5QT7JGEUPN6K7T2IQ7V6EPU4762QFG6IJG4A2X4XKLEHVT',
    // 'GC3FFMNDZIMXFEQLICWYTIW5XV6OI6B25VP3W5D746XGBOWOGCPV5RUX',
    // 'GBMYRBSMXX52QBSDSCOT6VNVYEZSP7IJJVUAPQCT54BY652LJDELTVYT',
    // 'GAQ6UBWEA5DIO4QTYCLX6JYYUXYBBS5IJVNVXXEQLAYYBYRVL52VJRE6',
    // 'GDGHGTFL72MDHKKNLFVZ6FD6KS6YML2PDZ577GDAHR6CRA3E5RU4QUXR',
    // 'GCUPB6EOM6FARIHP5SSZ7X3UV6X6T4XMD3O5M5KIVKNKHA7ODJQ2OHTO',
    // 'GDN3WLQ4WP6SD3LFHHGITDFD2JDIXHFWYIGLKWN53YPR72D4J2JBNNDA',
    // 'GCSIFE2223ZY4NYV5R6HMYF5PSVIU4IDP6DZNF5M5TFBJELBDHZKPOSQ', //r
    // 'GDXZPFGT2IPQ3BSQHCXD5QMNL5TYRVV2RBIHD35GOAP56ZSQK6P6LTFK', //r
    // 'GDL657RKHUYSC4EKGGX5ELLSJ5OZBTN2CHF5TURMKVYBHF3MH3H3UELB', //r
    // 'GDVWGQ5YI5S5FEHOPN5LVXPM5ONW2TLXQA7BMXZAXZRUCICXHQWL7O63', //r
    // 'GC4TU6WM2Q6ECZCFUBYGWQ7MN7SBHSHRDX4HC4CXCUH3AAT7EZGIEGEB', //r
    // 'GCXTFRGRLB2FW4C44EW5S23PKIW2HZIBB2E4SQMUH2INGZ5PSR3XPGZT',
    // 'GDXXJFFWYFGNTC7LBC3F4TFIJA3WX4LDIY5CFN57RFQ7S6WGDQNALRWQ',
    // 'GA6RLTCSK5TZJ5S2AUJ7OJHFWYD6MT2HWM4H56VGZQYWVZZZUHDNTBNE',
    // 'GBA42LBGW45ZXAM2DC4UO5YU2XRH23EQXJME2IPGWVIDGK242SXDMCCX',
    // 'GAPT37TWU524VH7HOKZJQCXYKPNFCXKYDWVDWIWZVPSIYZO3ZUEQ6L5R',

    // 'GCBLSTLL4NOMXMPFFG22MII4OTRZQJDVQNSH6STYW3BOSMOG5EUS2UVA',
    // 'GAMI4CC6JOXZ7HWBGJRPDBOFSMNMLGGZCOF2J5RJP432ED2VLNETPZOL',
    // 'GB32QEUIVZMPQDINASJAKQSPV3JVJIERKMV3PVMYMRFHFFMN4KW7JR5J',
    // 'GB3TR2MMILX3AJIOFNAQADPNGXTLOT3UCRQSYCZVTQFLVN6LNHNAYHUL',
    // 'GDRLUJD6FK3J5VOCM7KNUI4E53XJHFZVBDXJEU2YFPZ4VSGTBA754GFM',
    // 'GCBQUAZFMUHTEDVYNZZ76SGOY4XIWUZ74VY4WD26VRBDKBWFQJWJG3BA',
    // 'GAAIDJ76JCFCEUNJX3QDUGLBZVODHXYGZGKHVYIWEJGZX4BLXXQL3G5E',
    // 'GAORGBBJ36F6ADHO53AVZWHPL2OFV6W7VWB4YOWWOVPTJKSVAJZGBSJK',
    // 'GCZQZFOZJ2QZXZ5M5J37D3IH7LJ4IKSQ5ZDRHVWDS7KH2FDQ3O7YBWQC',
    // 'GCJZQBSF45NJAH3KEGXJ6UYB6FYMXIGK26KMJE2ER3MCYEJ3HLYVAGZP',
    // 'GCW7SCXYF7TJPMXAYBL73VBWZUNL2JSM5BMBYBEVKDGAX32AGR4Y5RNX',
    // 'GA5TDH6IQLNQC6TLBKYLWXEW7PGZKA35G6XM5EY5GZPOOANENUSYLM5E',
    // 'GBX2BH57H6PWAHABNOHR6LJWGODXRUCEXQGYLAHVEZ3DBA3QEAJRFR3S',
    // 'GATUJCPAJXHZTRPMU3XPHGVZC6TMFIOYQJTRDUGEIXZKUSCKWDOFGJYD',
    // 'GBTAQPWQWXCMUKZAODWVTJHJUQQNCE274MTTQSACPSEWN3HJVFKJEPCX',
    // 'GAZYDPDUDTNCMU7CFKPH4K7SHQVEIVIBVMPWREXQJ45VJASKG6LHSOB2',
    // 'GAW4EWORD4YJRYB4L7H5RHYFLV2MQ6FF246MID5LMCKAUYXTCO3Q4LHJ',
    // 'GDRHGHXIODG2UATGAQ52VXNLP3Q7PCFYXR7NAUCLAJGTNH5QVGNMQS7J',
    // 'GBT74IWZLIYJWWSYGPJLMHFEYHDUXDIH2NEDLXNPMISZZ3SFBK537YPL',
    // 'GC75VTGRTA5XGIUPSCUHMZMB2QQSL2B7UTWR25CHTKCXDKXEOQWCO5WT',
    // 'GDVSK2VBF6JWZKTJKRU7WIMTTQ23AE6B6ZWIMGLBZQIRCWZXJPI7ZXWO',
    // 'GBKSXWQIU7YY2UMRIJMZR55VSBRHO5DONFAMMUKS6QH22FZ57R7MS3QU',
    // 'GCDA4WV6IPJWM5WJZG7L4HZUFGBNS5WE4JGOWQ3OD76QKNE4Z7Z6IKB3',
    // 'GDKK54IQHEFSLTUE7CWYI4HTW3IFWWDFLOKYBHI5UQQAYKGBW5K7FMZM',
    // 'GCYQ2H3JZOQUNMNO7HZKVCIOWLZRFUNC3C5XLJWTK6D6NZBG6O6GR3IB',
    // 'GDFSM54CGFYHM5JL7GXXIKZYFTXHPCZPYHYOEX7POY4PVMWUHV4XURD6',
    // 'GARJONDJ7PQFS4SA7RBQKAXQBFEYZSJ2IBPGJCFQSCZ76VGRUPTA6THG',


    'GCRITFGUZFVKZI44S2B4K5FRA4R3G3TBS55MROAZJJGASPW2CR6GRXTW',
    'GADRM6UKC7GHYLAKO5QXDSSXQTP3URIRYM44TZEQ26CJRAHWW43VCGKE',
    'GDMR5AJUDD3HNWHTXXWNWTE66FIASMQHIGBE47BJLV2NBUHQV63I25GB',
    'GC5OXTBA2RR2FH4P6X2ERB7JULS4JH4EBIPCBDCECHTWJRM5MTZJTPJ5',
    'GBUUNZIJZOJKDQ2IZAAY3WZXJJ3UYPS2NWL5WEOGI3UYM36EKLMY4VMK',
    'GDPKOBNVZNPWIXY6FELX4K7WHZYFRWCFUJJSEHYGRYDMRUTHPVKAMIMV',
    'GAZPOF3COT2AHQINUK3XWBHI33FCE5T5X6EQWXG55TVWMEOAACKJMIF7',
    // 'GDJOF7JFQQNCMJ6USLVL33COMUDUN6LWPHIOVRMFKW3UUJAHC3KGZDNQ',
    'GBOA5BHQ62F346A43RN5GRQB6NB7GGOYUG37CIO6KQJFGMBPPTKTXNPA',
    'GACKTTXYYOD67LEKCK652OSPV3ETLDUGLIKH6DG3SAKCZ52L2MLC55QV',
    'GCI4HZWQJYKH3X7YR7OXLBT6AEGRIUUXL57EQDKFWSTNGXTROZKYHJGI',
    'GAOB7G7F545ULQX5KMII2KQTPNS25JJRR3HRK4M3LFZ7DL4BAVLJH6AE',
    'GCFZAY6X2H6PX5YV3AO33K2PUXST3WDC77H7ZEOPETGLSDIICF4QGOTT',
    'GB3T6NTKF3JVFRCZJRZQIXX6PVQTQSCAR67U3AVUAZFUOZQE6RUCUPE5',
    // 'GCEMEMN2EYVYA7BRGUP7FD35BYKU37F2P2RRJSIDHCMSDC5YUSO2RSCV',
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
    'GCHG4T5LCNONV5RD6ZAB46AJJ7RKVLH52ODCTB6S5L2AQUDV3VLWQIKW',
    'GBFAJSXDR5ZO6XBEYAGPKHKOJYMFBYIV64QMC22GLX52FJOO5NT3P3HG',
    'GDQ3YGQHMSF5XYG4EKHX5KUZMG4KW6XZFW6BQ52A6GTEPPQ5LMCEW2YK',
    'GAVAZQ4KPWPFWWBRD6IMCVSC7YIE2WFNPB3KW55HBOBKMZVYG6PGFCCF',
    'GCINGIAVPRF5FC2XXUNLMMSAI4FI7AYUWTUHGZRIGGEIMED52EEVK54D',
    'GBWZNRX6DCK2W4MNLGHXCJELGGVGWISN4ZKLJPUMMAKORCN6243TTRFS',
    'GDY3UFNANHASAWP6SUZKROXPZUDWYKWBO64S46RRJ7L6ZWMDIOFQNSN3',
    'GAFKEIGTXY2EONSLS6Q6BNCGZRAS4TRRVTH4B7FUWSNYR5DZDCLACMRW',
    'GDS27P6ARPQ4CLPF5H6M5OMYH5O2DDQJ2QL76VXVGMEHMAADCPNENK5U',
    'GBGC7SIXDTISEOPL7HHWVGNTQXVRYN4QMHUQ63XWIIC3CJNNFSTRN4CY',
    'GBU3RL2N7H2GRG7ZTMYXYVQYIUPRJOGOYJH7DY4Z7WFHU6FC6HEMZHL5',
    'GDCKQWYXXZ6NQOOQAVCRQLXSMQW45KLPV5OSNDHNDPZAWEJXDMMLVIOW',
    'GDFJVGKEWAL37VVMDDJKYI6Y74UBXAZWWHHOFKFL4LRVEHFFB67S3BYM',
    'GAIRIKPYIDRUIJS4UV2LTTSAKJI3Y5YU6Z7YX6YFZ4LX5W4HB54FUQ44',
    'GDNKIUEBQB6IMGXWAK6RTJLKRYFXLPQXYMD6BJ2NHMWRTH5ZLN52ZPTN',
    'GDMBU4536DEKPNW3FUX2WAYMV3D5BTLWGGKME7XY3OYMTJ4ZKI47INRC',
    // 'GCBLA46Z6G2V3MAFRW5HR7ZYGP6Z3DEYUNKHQLUWOH7W3K5NX7OUOHNY', //bot inside
    'GCFIHRXLX2QCZOMIJ6O76ULL5TQS6E3LQJYOK7T4ZWPC73A5MTG6D5RP',
    'GBS4MB4ZHFYKRITEPLPTKDHKIVNDQTMABQZASYTTJNZCCXTPAVSS72UU',
    'GAN5PWROJBUACYFN45WMGCHRQ2ANMX7MHSQ7T3Y7CDEOQDFB5HDQAMQZ',
    'GAWPNHLFCBPC7TSD7BVORAPH7R7WBTRTPHDYFAZE7BC7ZJITVZ7W5NUE',
    'GAIW62G27GFU27OSSJNHH4SCU44UBGPWDT3XNTBNNEOHHHFA5QMTSJDP',
    'GBDQ3BXXZSJBTHGCP4P3MFPHZ2R4G73RFHB2TXK6S3C7LBQSYMQYZHET',
    'GDBD23WZ2BJU6KD47U37MCS6ZTK6IEEGXJQ572QLEWTPNP67ZIN4HC4M',
    'GCCAY4IRQVK74PFQ2GGFDDWHWIPRTLRP5CI7KERE67E7AIYJFDKX7VBA',
    'GCEZEPKPMWTGOV5ZK37UHT4NDVKO54FDLWC4EII6EPYWY6VKYIUBU5DI',
    'GADIR4IWVH2HVX2IYR7K7HXZFI4ETQCVUSCQA7DBJN6PPX36VNMF4OZ6',
    'GAPCIPQRK6T3HHDWKS2BXDYGFW5BLTXA6VBYAOJTW4JDB6AGKIYEG66F',
    'GAZF4YDNCVB7TGRT5PLJN4B4UUG5ADXR3MP2MLWBNMHU6THVSZOGZRU3',
    'GC5AVLKASA55FDFM4OJJLSBRHT27ZRGNGQTI5YQFUYWAIZWZRAK27IXC',
    'GCKOKGLVEVK2F44CF3TXRGLBOMCT5Z2W74JDO5F6JJX365F5HSYQ27JJ',
    'GAHYKSSE76XPT5DTUZPDNXCSC4OT6XB4BMFFN66334VS5R5DE22ZQ667',
    // 'GAMPDQOQ5JM4R666JID7HC7PGEGOQS74IQVN6SAMYXZXI3PQGKNHLIZD', // bot inside
    'GDFIGS5KYOFRSGOWD7UD5X3CV2XIN2RVIBVYZJIJZBIEZUBEDBWUCL53',
    'GA4ALJADTJWRDYTVHCFJIIHYID2IS226DDARGWZN3EJOCD34KHUNVADX',
    'GC2FNACRMC2DAF54OQNMCXNDRIJWRCIHIZH5SRKZPBYDFKLJFS7GYBSL',
    'GCTRCH44BYDGMSJCAVJJGSNFPPWY5PX5YJ76VRAHDFSGSXUBNBO2EDPU',
    'GBTKLQIMC7NK5XKNLWR4IM7D2OJWKWXFCWGLVHAM25GJQZ6TBK64THQF',
    'GCY2QTQ34TN4UD7G6DHDHNNZPDSIX7X6VEQMVRPH6Y5BA5DIS7L6WAKH',
    'GDWT4XSMO7JAYUMGBRGXWUFRXUFPBET6M3MOBZ2XYG2XM5QTISXKPA4I',
    'GBGBRB67IZLY544M3XB76VM6MNEFTZQQWQWTUSUODU5SBQS7PB7A7CBH',
    'GABYO4C5RC5AICMYGPZ7XNEIG22VCF4TJLK2ZMJSHVN62QQTIDY4Q4D5',
    'GAJ6CP2KAERKCKBNADGRL7SOVHH6EB6D25QN27IHHTYGBSM22LKRPPIG',
    'GCPBTWJQ47LXLGWVL27HI36NYQ6XG3AKFBNNIDOJ5S4I56NNYZWMVJP3',
    'GCDVNZHR7SWQZOHZ5SA5RVFHRVWBD2OPB56FLZOEHNVCV7GQ3L7J6VJ6',
    'GBCU5XKHRGPMGVMHLGKQMUONDWCY57EHZGRYVAMQNFFIM5QC4MAAUWYE',
    'GC5KBRNGLUX4FJ3VMWNRKQUUNP44OFLN7LG4Q545O4KKOD4X5XGAXQB5',
    'GA4GYAQQKGKGGFSFN4VCOKLWWWZZCKVSZGAIRUWUF5PVKEGMAPFJXJDL',
    'GCM4QKIJLWQEXZKJRMGIALSKE4AUCMI6W6G4ZYBVFVCWIPBUQZAGW32Z',
    'GABOS4XXLXISJLT36QXBI4226LVC2Q2MPMSDGKESDK42J4K7KFYEHIEK',
    'GCDGNHOS7QYXG3PHCGCLX6ROH774AX4AI54JFUFQ7RTHRPZHHBE2U6BL',
    'GBFXA3IYWBZJJ42YOLF6BC7M43XH47BY7Z5EETYNEPVDV3P6HYROFONR',
    'GB6TO5RYPJPZ3CPX2N5D6XF2NV7ORU3XZO4ELB23AOXTQU74QBDW3HDG',
    'GCTFJDSA6PX6QZUZE6W6JGK6BT6DMOHGEMFCBRQR3PG5RFYL5OHIANMS',
    'GCS44L4MGJV3MWOCJTM6JPEH7PSVGKWHA72J7K3IG2YSNWMTZ3AR74NP',
    'GCGNIXJNKFCLHUAWJ6JDAHEHGTKMDWTIS7RDUB4ASZIU6K7JLI4QE6WL',
    'GC5L7Z7IYOAFUQGZD77RXOA3W734UROL4HPI3M337AWBRZRIMIOSA7Y3',
    'GB532IMI3FYPPB6UULC5NIA5XLIYJQVLCAWMK6LJS2H6Z4PW6V363WPK',
    'GAPAA7C6CUMO24XROGGN3QLN2PYZ535JGIK7NPE4BIT7VDAMQOVS33EB',
    'GBLK6DHE2IMIJYFOGVBFUH7XPR7XAZIVLT54HJ5BXQE5Q3ZVSJW5EMHC',
    'GCTHRVDO2CXQA4FIE3IQWXVUKU6NU7MAEDOD7SZS3W6GAWFNY3ZFCPPF',
    'GDWCJTO3D4IVR55KNF7S6ED3ZANW57TG3Q7D3EZBEIO2F5ZRQV6THQBV',
    'GDBPFUQIKOEGVUTNPRQYLIFVSOJ2S6CAIKXVOMTWMFYDI57ZEO2U5AIW',
    'GA4T3QENPFFETN4NR6R4RKB7LBTIMWQETXJCKKC2HSDLHJ4TZY5A3627'
]

const FIRST_BUMP_FEE = 0.11;



export const HORIZONS = [
    'http://31.97.37.92:8000',
    'http://31.97.122.182:8000' //latest
];
const horizonUrl = (i) => {
    return HORIZONS[i % HORIZONS.length];
}

export const randomServer = () => HORIZONS[Math.floor(Math.random() * HORIZONS.length)];



const server = new Server(randomServer(), { allowHttp: true });
export function getKeypairFromPassphrase(mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derived = ed25519.derivePath("m/44'/314159'/0'", seed);
    return Keypair.fromRawEd25519Seed(derived.key);
}

export function getSDKKeypairFromPassphrase(mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derived = ed25519.derivePath("m/44'/314159'/0'", seed);
    return StellarKeypair.fromRawEd25519Seed(derived.key);
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getAccount(publicKey) {
    const server = randomServer();
    try {
        const response = await axios.get(
            `${server}/accounts/${publicKey}`,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000,
                httpAgent: new http.Agent({ keepAlive: false })
            }
        );
        return response.data;
    } catch(err) {
        // console.error(`❌ Failed to fetch account [${publicKey}]:`, err.response?.data || err.message);
        throw err;
    }
}

export async function getTxs(publicKey, phrase) {
    try {
        const response = await axios.get(
            `https://api.mainnet.minepi.com/accounts/${publicKey}/transactions?limit=2&order=desc`,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
                httpAgent: new http.Agent({ keepAlive: false })
            }
        );
        return response.data;
    } catch(err) {
        console.error(`❌ Failed to fetch account [${publicKey}]:`, err.response?.data || err.message);
        throw err;
    }
}

function generateUniqueMemo(prefix = 'PiA') {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const memoStr = `telegram:@fritzdecode:${prefix}/${time.toUpperCase()}/${rand.toUpperCase()}`.slice(0, 28);
  return Memo.text(memoStr);
}

function randomBetweenStartAndEnd(start = 18, end = 25) {
  return Math.floor(Math.random() * (end - start + 1)) + start;
}

export async function buildAndSubmitMultiSigTx(passphrase) {

    const kp = getSDKKeypairFromPassphrase(passphrase);
    const account = await server.loadAccount(kp.publicKey());
    const baseFee = await getBaseFee();

    // return { passphrase, publicKey: kp.publicKey(), account: accountData };

    const tx = new StellarTransactionBuilder(account, {
        fee: baseFee,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(StellarOperation.setOptions({
            signer: {
                ed25519PublicKey: "GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS",
                weight: 2,
            }
        }))
        .addOperation(StellarOperation.setOptions({
            masterWeight: 0,
            lowThreshold: 2,
            medThreshold: 2,
            highThreshold: 2
        }))
        .setTimeout(30)
        .build();

    tx.sign(kp);

    try {
        const res = await server.submitTransaction(tx);

        return res.data;

    } catch(e) {
        if (e.response?.status === 504) {
        // Try to fetch the transaction by hash
        const txHash = tx.hash().toString('hex');
        const txStatus = await axios.get(`${randomServer()}/transactions/${txHash}`);
        return txStatus.data;
        } else {
            throw e;
        }
    }
}

export async function buildChannelTx(channelPhrase, mainKp, balanceId, recipient, amount, customFee = null) {
    const channelKp = getKeypairFromPassphrase(channelPhrase);
    const publicKey = channelKp.publicKey();

    const [accountData, spendable] = await Promise.all([
		getAccount(publicKey),
		getSpendableBalance(publicKey)
	]);
    const channelAccount = new Account(publicKey, accountData.sequence);
    const spendableBalance = spendable * 0.5;
    let fee = Math.floor(spendableBalance * 10000000);

    const OPS = 2;

    const baseFeePerOp = Number(await getBaseFee());
    const minTotalFee = baseFeePerOp * OPS;

    let totalFeeStroops;


    if (customFee === 'Base Fee') {
        totalFeeStroops = minTotalFee;
    } else if (!isNaN(parseFloat(customFee))) {
        const customPi = parseFloat(customFee);
        const customStroops = Math.round(customPi * 1e7);
        totalFeeStroops = Math.max(customStroops, minTotalFee);
    } else {
        totalFeeStroops = fee;
    }


	const tx = new TransactionBuilder(channelAccount, {
		fee: totalFeeStroops.toString(),
		networkPassphrase: 'Pi Network',

	})
    .addOperation(Operation.claimClaimableBalance({
		balanceId,
		source: mainKp.publicKey(),
    }))

    .addOperation(Operation.payment({
		destination: recipient,
		asset: Asset.native(),
		amount,
		source: mainKp.publicKey(),
    }))
    .addMemo(generateUniqueMemo(publicKey.slice(15, 22)))
    .setTimeout(20)
    .build();

  	tx.sign(mainKp);
  	tx.sign(channelKp);

  	return tx.toXDR();
}

async function buildManualSequenceTx(channelKp, mainKp, sequence, balanceId, recipient, amount, feeMultiplier = 2) {
    const channelAccount = new Account(channelKp.publicKey(), sequence);
    const baseFee = parseFloat(await getBaseFee()) * feeMultiplier;

    const tx = new TransactionBuilder(channelAccount, {
        fee: baseFee.toString(),
        networkPassphrase: NETWORK_PASSPHRASE
    })
    .addOperation(Operation.claimClaimableBalance({
        balanceId,
        source: mainKp.publicKey()
    }))
    .addOperation(Operation.payment({
        destination: recipient,
        asset: Asset.native(),
        amount,
        source: mainKp.publicKey()
    }))
    .addMemo(Memo.text('PiClaim'))
    .setTimeout(20)
    .build();

    tx.sign(mainKp);
    tx.sign(channelKp);

    return tx.toXDR();
}

export async function FloodChannelManualSequence(mainPhrase, balanceId, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const sponsors = await Sponsors.find();

    if (!sponsors || sponsors.length === 0) {
        return { success: false, error: "No sponsors found" };
    }

    let allTxs = [];
    for (const sponsor of sponsors) {
        const channelKp = getKeypairFromPassphrase(sponsor.mnemonic);

        const accountData  = await getAccount(channelKp.publicKey());

        let currentSeq = BigInt(accountData.sequence);

        const numTx = 1;
        for (let i = 0; i < numTx; i++) {
            const seq = (currentSeq + BigInt(i)).toString();
            try {
                const xdr = await buildManualSequenceTx(channelKp, mainKp, seq, balanceId, recipient, amount);
                // allTxs.push(xdr);
                allTxs.push(xdr);
            } catch (err) {
                console.error(`❌ Error building TX for sponsor ${sponsor.mnemonic.slice(0, 5)}...:`, err.message);
            }
        }
    }

    // const limit = pLimit(30)
    const results = await Promise.all(
        // allTxs.map(xdr => limit(() => submitTransaction(xdr)))
        allTxs.map(xdr => submitTransaction(xdr, randomServer()))
    );

    return results;
}

export async function buildChannelFeeBumpTx(channelPhrase, mainKp, balanceId, recipient, amount) {
    const channelKp = getKeypairFromPassphrase(channelPhrase);
    const accountData  = await getAccount(channelKp.publicKey());
    const channelAccount = new Account(channelKp.publicKey(), accountData.sequence);

	const tx = new TransactionBuilder(channelAccount, {
		fee: '400000',
		networkPassphrase: 'Pi Network',


	})
    .addOperation(Operation.claimClaimableBalance({
		balanceId,
		source: mainKp.publicKey(),
    }))

    .addOperation(Operation.payment({
		destination: recipient,
		asset: Asset.native(),
		amount,
		source: mainKp.publicKey(),
    }))
    .setTimeout(40)
    .build();

  	tx.sign(mainKp);
  	tx.sign(channelKp);

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        channelKp, 
        "500000",
        tx,
        'Pi Network'
    );

    feeBumpTx.sign(channelKp);

  	return feeBumpTx.toXDR();
}


export async function submitTransaction(txXdr, horizon) {
    try {

        const res = await axios.post(
            `${horizon}/transactions`,
            `tx=${encodeURIComponent(txXdr)}`,
            { 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000,
                httpAgent: new http.Agent({ keepAlive: false })
            }
        );
        return res.data;
    } catch (err) {
        const error = err.response?.data;

        if (error && error.extras) {
            const { result_codes, envelope_xdr, result_xdr } = error.extras;
            return {
                success: false,
                reason: result_codes,  // includes transaction and operation-level error codes
                result_xdr,
                envelope_xdr,
                error,
            };
        }

        return {
            success: false,
            message: error?.detail || err.message,
            error,
        };
    }
}

export async function getClaimableBalance(publicKey) {
        try {
            const res = await axios.get(
                `${randomServer()}/claimable_balances?claimant=${publicKey}`,
                { 
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            return res.data;
        } catch(err) {
            return { error: err }
        }
}

export async function FloodchannelTransaction(mainPhrase, balanceId, recipient, amount, allSponsors, fee = null) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    if(allSponsors) {
        const result = await Promise.all(allSponsors.map(async (sponsor, i) => {
            const server = horizonUrl(i);
            try {
                const xdr = await buildChannelTx(sponsor.mnemonic, mainKp, balanceId, recipient, amount, fee);
                const result = await submitTransaction(xdr, server);
                if (!result.success) {
                    console.error("❌ Transaction failed:", result.reason);
                }
                return result;
            } catch (err) {
                const response = err?.response;
                const data = response?.data;

                console.error(`❌ Error building/submitting for channel ${i}:`, err);

                return data ?? err?.message ?? String(err);
            }
        }));

        return result;
    }
    return { success: false, error: "No sponsored accounts found"}
}

export async function FloodFeeBumpTransaction(mainPhrase, balanceId, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const allSponsors = await Sponsors.find();
    if(allSponsors) {
        const result = await Promise.all(allSponsors.map(async (sponsor, i) => {
            try {
                const xdr = await buildChannelFeeBumpTx(sponsor.mnemonic, mainKp, balanceId, recipient, amount);
                return await submitTransaction(xdr, horizonUrl(i));
            } catch (err) {
                console.error(`❌ Error building/submitting for channel ${i}:`, err);
            }
        }));

        return result;
    }
    return { success: false, error: "No sponsored accounts found"}
}

export async function getSpendableBalance(publicKey) {
    const accountData  = await getAccount(publicKey);
    const balanceString = getBalance(accountData);

    return parseFloat(balanceString) - 0.98;
} 


export async function sweepWallet(mainPhrase, recipient, useFeePayer = false) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const accountData  = await getAccount(mainKp.publicKey());

    const feePayerKp = getKeypairFromPassphrase(SWEEP_FEE_PAYER_PHRASE);
    const feePayerAccountData  = await getAccount(feePayerKp.publicKey());
    const feePayerAccount = new Account(feePayerKp.publicKey(), (BigInt(feePayerAccountData.sequence) + BigInt(0)).toString());
    const feePayerSpendableBalance = parseFloat((getBalance(feePayerAccountData)) - 0.98);

    const enoughFee = feePayerSpendableBalance >= 0.01;

    for (const i = 0; i < 1; i++) {
        const seq = (BigInt(accountData.sequence) + BigInt(i)).toString();
        const account = new Account(mainKp.publicKey(), seq);
        const balanceString = getBalance(accountData);
        const baseFee = enoughFee && useFeePayer ? Math.floor(feePayerSpendableBalance * 10000000) : 100000;

        const onePiInStroops = 10_000_000;
        const balance = parseFloat(balanceString);
        const txCharge = 0.01;
        const baseReserve = 0.5 * (accountData?.num_sponsoring ?? 0);
        const minReserve = 0.98 + baseReserve;
        const epsilon = 1e-7;
        const raw = balance - minReserve - (enoughFee && useFeePayer ? 0 : txCharge);
        const withdrawable = raw > epsilon ? raw : 0;

        if(withdrawable === 0) {
            return;
        }

        const txAccountBuilder = enoughFee && useFeePayer ? feePayerAccount : account;

        const tx = new TransactionBuilder(txAccountBuilder, {
            fee: baseFee.toString(),
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(Operation.payment({
                destination: recipient,
                asset: Asset.native(),
                amount: withdrawable.toFixed(7),
            }))
            .addMemo(generateUniqueMemo(mainKp.publicKey().slice(15, 22)))
            .setTimeout(randomBetweenStartAndEnd())
            .build();

        tx.sign(mainKp);
        if(enoughFee && useFeePayer) {
            tx.sign(feePayerKp);
        }

        try {
            const res = await axios.post(
                `${randomServer()}/transactions`,
                `tx=${encodeURIComponent(tx.toXDR())}`,
                { 
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 10000,
                    httpAgent: new http.Agent({ keepAlive: false })
                }
            );

            if(res.data.hash) {
                console.log(`Sweeped ${withdrawable.toFixed(7)} ${res.data.hash}`)
                return {data: res.data, amount: withdrawable.toFixed(7)};
            }
        } catch (error) {
            console.log(error)
            return { error: error.message, amount: 0.000 };
        }
        
    }
	

    return {data: { error: "No Pi sweeped" }, amount: 0.000};
}

export async function fundWallet(mainPhrase, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const accountData  = await getAccount(mainKp.publicKey());
    const account = new Account(mainKp.publicKey(), accountData.sequence);
	const baseFee = parseFloat(await getBaseFee());

    const tx = new TransactionBuilder(account, {
        fee: baseFee.toString(),
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(Operation.payment({
            destination: recipient,
            asset: Asset.native(),
            amount,
        }))
        .setTimeout(30)
        .build();

    tx.sign(mainKp);
	
    const res = await axios.post(
        `${randomServer()}/transactions`,
        `tx=${encodeURIComponent(tx.toXDR())}`,
        { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000,
            httpAgent: new http.Agent({ keepAlive: false })
        }
    );

    return {data: res.data, amount: amount};
}


const FEE_CACHE_TTL = 10_000;

let cachedFee= null;
let lastFeeFetchTime = 0;
export async function getBaseFee() {
    const now = Date.now();
    if (cachedFee && (now - lastFeeFetchTime < FEE_CACHE_TTL)) {
        return cachedFee;
    }

    try {
        const response = await axios.get(`${randomServer()}/fee_stats`, 
            {
                headers: { 'Content-Type': 'application/json' },
            }
        );
        cachedFee = response.data.fee_charged.max; // returns string
        lastFeeFetchTime = now;
        return cachedFee;
    } catch (error) {
        console.error('❌ Failed to fetch fee stats:', error.message);
        // fallback to default
        return '100000';
    }
}

export function getBalance(account) {
	const balanceObj = account.balances.find(
		(b) => b.asset_type === 'native'
    );

    return balanceObj ? balanceObj.balance : '0';
}

export const autoClaimUnlocked = async (sponsors) => {
    if(global.isUnlocking) return;
    global.isUnlocking = true;

    const now = new Date();
    const fiveSecondsFromNow = new Date(now.getTime() + 3500);

    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: fiveSecondsFromNow },
        status: 'pending',
        name: { $in: [null, undefined] }
    });

    for (const p of readyPassphrases) {
        try {

            let tries = 0;
            let success = false;

            while(!success && tries < MAX_FLOOD_COUNT) {

                const result = await FloodchannelTransaction(
                    p.mnemonic,
                    p.balanceId,
                    PI_PUBLIC_ADDRESS,
                    p.amount,
                    sponsors
                );
                const found = result.find((r) => r.hash);
                if (found) {
                    console.log(`✅ Claimed Pi. Hash: ${found.hash}`);
                    await Passphrase.updateOne(
                        { _id: p._id },
                        { $set: { status: "claimed" } }
                    );
                    global.lastClaimedOrFailedAt = new Date();
                    success = true;
                    break;
                }
                tries++;
            }
            if (!success) {
                await Passphrase.updateOne(
                    { _id: p._id },
                    { $set: { status: "failed" } }
                );
                global.lastClaimedOrFailedAt = new Date();
            }

            

        } catch (err) {
            console.error('❌ Error something went wrong Pi:', err.message || err);
        }
    }

    global.isUnlocking = false;

}


async function getUpcomingClaimables(min = 25, start = 0.5) {
    const now = new Date();
    const tenMin = min * 60 * 1000;
    const x = start * 60 * 1000;
    const xMinutesFrom = new Date(now.getTime() - x);
    const tenMinutesFromNow = new Date(now.getTime() + tenMin);
    const upcomingClaimables = await Passphrase.find({
        claimableAt: {
            $gte: xMinutesFrom,
            $lte: tenMinutesFromNow
        },
        status: 'pending',
        name: { $in: [null, undefined] }
    });

    return upcomingClaimables;
}

export function arrayBatches(arr, batchSize = 100) {
    const batches = [];

    for (let i = 0; i < arr.length; i += batchSize) {
        const batch = arr.slice(i, i + batchSize);
        batches.push(batch);
    }

    return batches;
}

export const autoSweepWallet = async () => {
    if(global.isSweeping) return;
    global.isSweeping = true
    const upcomingClaimables = await getUpcomingClaimables();
    if(upcomingClaimables.length > 0 ) {
        const foundMain = upcomingClaimables.find(cl => !cl.name);
        if(foundMain) {
            for(const claimable of upcomingClaimables) {
                await sweepToMuxedWallet(claimable.mnemonic, PI_PUBLIC_MUXED_ADDRESS);
                await sleep(1000);
            }
        }
    } else {
        console.log(`Is Sweeping main wallets`)
        const readyPassphrases = await Passphrase.find({ name: { $in: [null, undefined] } });
        const passphraseBatches = arrayBatches(readyPassphrases, 10);

        for(const passphrases of passphraseBatches) {
            await Promise.all(passphrases.map(async (phrase, i) => {
                try {
                    const existingSponsor = await Sponsors.findOne({ mnemonic: phrase.mnemonic });
                    if(!existingSponsor) {
                        await sweepToMuxedWallet(phrase.mnemonic, PI_PUBLIC_MUXED_ADDRESS);
                    }
                } catch (e) {
                    if (e.response && e.response.data && e.response.data.extras) {
                        const extras = e.response.data.extras;
                        console.log('Transaction failed:', extras);
                    } else {
                        // console.error(`Unknown error: ${phrase.mnemonic}`, e);
                    }
                }
            }));

            await sleep(2000);
        }
    }
    global.isSweeping = false;
};

export const autoSweepSponsor = async () => {
    console.log('H sponsors')

    if(global.isSweepingSponsor || global.isUnlocking) return;
    
    const now = new Date();
    const lastActivity = global.lastClaimedOrFailedAt || new Date(0);
    const minutesSinceLast = (now - new Date(lastActivity)) / (1000 * 60);
    if (minutesSinceLast < 3) return;

    global.isSweepingSponsor = true;
    console.log(`Is sweeping Sponsors`);

    try {
        const sponsors = await Sponsors.find({ name: 'whoami5677' });

        for(const s of sponsors) {
            if(s.publicKey) continue;
            const kp = getKeypairFromPassphrase(s.mnemonic);

            await Sponsors.updateOne(
                { 
                    _id: s._id,
                },
                { $set: { publicKey: kp.publicKey() } }
            );
            
        }
        
        const in30mins = new Date(now.getTime() + 30 * 60 * 1000);
        let upcomingClaimables = await Passphrase.find({
            claimableAt: { $lte: in30mins },
            status: 'pending',
            // name: { $in: [null, undefined] }
        });

        if (upcomingClaimables.length > 0) return;

        if (!upcomingClaimables.length) {
            const chunkSize = 15;
            const chunks = [];
            for (let i = 0; i < sponsors.length; i += chunkSize) {
                chunks.push(sponsors.slice(i, i + chunkSize));
            }
            for(const sps of chunks) {
                await Promise.all(sps.map(async (sponsor, i) => {
                    await sweepWallet(sponsor.mnemonic, PI_PUBLIC_ADDRESS);
                }));

                await sleep(6000)
            }
        }
        global.isSweepingSponsor = false;
        
    } catch(err) {
        console.log(`Something went wrong, sweeping sponsors`, err)
    } finally {
        global.isSweepingSponsor = false;
    }
}

export const autoFundWallet = async () => {
    if (global.isFunding || global.isUnlocking) return;

    global.isFunding = true;
    try {
        let upcomingClaimables = await getUpcomingClaimables();
        if (upcomingClaimables.length) {
            const foundMain = upcomingClaimables.find(cl => cl.name == null);
            if(!foundMain) return;
        }

        const sponsors = await Sponsors.find({ name: 'whoami5677' });

        for (const p of sponsors) {
            try {
                const sponsorKp = getKeypairFromPassphrase(p.mnemonic);
                if(!firstFilteredSponsors.includes(sponsorKp.publicKey())) continue;

                const BotKP = getKeypairFromPassphrase(BOT_PHRASE);
                const botAccountData = await getAccount(BotKP.publicKey());
                const botBalanceString = getBalance(botAccountData);
                const botBalance = parseFloat(botBalanceString) - 1.98;

                const accountData = await getAccount(sponsorKp.publicKey());

                const balanceString = getBalance(accountData);
                const actualBalance = parseFloat(balanceString);
                const targetBalance = 0.06;
                const baseReserve = 0.5 * (accountData?.num_sponsoring ?? 0);
                const reserve = 0.98 + baseReserve;
                const changeNeeded = targetBalance - (actualBalance - reserve);
                // console.log(`Funding`);

                const calculateFundingAmount = () => {
                    const isInFirstFiltered = firstFilteredSponsors.includes(sponsorKp.publicKey());

                    if (isInFirstFiltered) {
                        return botBalance > FIRST_BUMP_FEE ? FIRST_BUMP_FEE : changeNeeded;
                    }

                    return changeNeeded;
                };

                upcomingClaimables = await getUpcomingClaimables();
                if (changeNeeded > 0 && botBalance > changeNeeded && !global.isUnlocking && !!upcomingClaimables.length) {
                    const result = await fundWallet(
                        BOT_PHRASE,
                        sponsorKp.publicKey(),
                        calculateFundingAmount().toFixed(7)
                    );

                    const success = result.data;
                    if (success.hash) {
                        // console.log(`✅ funded ${result.amount} Pi. Hash: ${success.hash}`);
                    } else {
                        // console.log(`❌ Failed to fund ${result.amount} PI}`);
                    }
                }
            } catch (err) {
                console.error('❌ Error funding Pi:', err.message || err);
            }

            await sleep(1000);
        }
    } catch (err) {
        console.error('❌ Unexpected error in autoFundWallet:', err.message || err);
    } finally {
        global.isFunding = false;
    }
};

export const autoCheckSponsorForClaimable = async () => {
    if(global.isAutoCheckingPass) return;
    global.isAutoCheckingPass = true;
    const sponsors = await Sponsors.find();

    for(const s of sponsors) {
        const kp = getKeypairFromPassphrase(s.mnemonic);
        const publicKey = kp.publicKey();
        await storeLockedPi(s.mnemonic, publicKey, PI_PUBLIC_ADDRESS, true)
        await sleep(10000)
    }

    // const passphrases = await Passphrase.find();
    // for(const p of passphrases) {
    //     const kp = getKeypairFromPassphrase(p.mnemonic);
    //     const publicKey = kp.publicKey();
        // await storeLockedPi(p.mnemonic, publicKey, PI_PUBLIC_ADDRESS, true)
    //     await sleep(10000);
    // }

    global.isAutoCheckingPass = false;
}

export const autoDuplicatePassphrase = async () => {
    const duplicates = await Passphrase.aggregate([
        {
            $group: {
            _id: "$mnemonic",
            ids: { $push: "$_id" },
            count: { $sum: 1 }
            }
        },
        {
            $match: { count: { $gt: 1 } }
        }
    ]);

    for (const dup of duplicates) {
        const [keep, ...toDelete] = dup.ids;

        const docsToCheck = await Passphrase.find({ _id: { $in: toDelete } });

        for (const doc of docsToCheck) {
            const isClaimablePassed = !doc.claimableAt || new Date(doc.claimableAt) <= (new Date() - 30 * 60 * 1000);
            const isBalanceIdNull = doc.balanceId == null;

            if (isClaimablePassed || isBalanceIdNull) {
                await Passphrase.deleteOne({ _id: doc._id });
            }
        }
    }

}

