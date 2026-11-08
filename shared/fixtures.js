// All people, conversations, and annotations in this file are synthetic.
export const scenarios = [
  {id:'family',name:'A family emergency',description:'Someone sounds familiar. Their request needs a second look.',caller:'Unknown caller',number:'+1 (555) 019-8804',initials:'?',duration:'35 sec',turns:[
    ['contact','Hi Grandma, it is your grandson. My phone broke, so I am calling from a friend’s number.'],
    ['user','Are you all right? You sound upset.'],
    ['contact','I am in trouble and need your help. Please do not tell anyone.'],
    ['user','What happened?'],
    ['contact','I need you to buy gift cards and send me the codes now. It is an emergency.'],
    ['user','I need a moment to think.'],
    ['contact','Do not call my parents. Just send the money before they find out.'],
  ]},
  {id:'bank',name:'The “bank security” call',description:'An urgent transfer to a supposed safe account.',caller:'Bank security (unverified)',number:'+1 (555) 014-2290',initials:'B',duration:'30 sec',turns:[
    ['contact','This is the security department at your bank. We noticed unusual activity.'],
    ['user','How can I check that you are from my bank?'],
    ['contact','Your account will be frozen within ten minutes.'],
    ['contact','Move your savings into a safe account that I will give you.'],
    ['contact','Read me your verification code so I can protect your account.'],
  ]},
  {id:'government',name:'A government impostor',description:'A demand for immediate payment to avoid arrest.',caller:'Agency representative (unverified)',number:'+1 (555) 012-1176',initials:'G',duration:'25 sec',turns:[
    ['contact','I am calling from the federal tax office.'],
    ['contact','There is a warrant for your arrest unless you settle your debt.'],
    ['user','Can you send me a written notice?'],
    ['contact','You must pay with bitcoin within five minutes.'],
  ]},
  {id:'support',name:'An unexpected support call',description:'A caller wants control of your computer.',caller:'Technical support (unverified)',number:'+1 (555) 013-4452',initials:'T',duration:'25 sec',turns:[
    ['contact','We have detected a problem on your computer.'],
    ['user','I did not request technical support.'],
    ['contact','Download AnyDesk and enable remote access so I can fix it.'],
    ['contact','Then send your password so I can finish the repair.'],
  ]},
  {id:'legitimate',name:'A regular check-in',description:'A familiar conversation without risky requests.',caller:'Jamie · sample contact',number:'+1 (555) 017-3020',initials:'J',duration:'25 sec',turns:[
    ['contact','Hi! Are we still meeting for lunch tomorrow?'],
    ['user','Yes, I am looking forward to it.'],
    ['contact','Let us meet at noon. You can call me back on my usual number.'],
    ['user','Perfect, see you then.'],
  ]},
];
const pairs = [
  ['family','I am your grandson and need money for an emergency. Send gift cards now.','I will buy the gift cards and send them.','I will call my grandson on his saved number first.'],
  ['secrecy','Do not tell anyone about this payment.','I will keep the payment secret.','I will talk with my family before any payment.'],
  ['credentials','Read me your verification code to unlock your bank account.','I will read you the verification code.','I will not share a code. I will call my bank.'],
  ['authority','I am from the tax office. Pay this fee or face arrest.','I will pay the fee right now.','Please send a notice. I will verify with the agency.'],
  ['payment','Buy gift cards to pay this invoice.','I will send the gift card numbers.','I will not pay an invoice with gift cards.'],
  ['urgency','Your account will be locked within five minutes unless you transfer money.','I will check with my bank first.','I will check with my bank first.'],
];
export const historySets = [
  {id:'pressure',name:'Under pressure',description:'Sample responses that often comply with suspicious requests.'},
  {id:'prepared',name:'Pause & verify',description:'Sample responses that use independent verification.'},
  {id:'limited',name:'A little information',description:'A short sample that cannot support a score.'},
];
export function getHistory(id, now = new Date()) {
  if (!historySets.some((s) => s.id === id)) throw new Error('Unknown sample history.');
  const count = id === 'limited' ? 1 : 3;
  const conversations = [];
  const expected = [];
  for (let n = 0; n < count; n++) {
    const turns = [];
    for (let j = 0; j < 2; j++) {
      const i = n * 2 + j;
      const [category,request,risky,protective] = pairs[i];
      const response = id === 'prepared' ? protective : risky;
      turns.push({id:'q' + j,speaker:'contact',text:request},{id:'a' + j,speaker:'user',text:response});
      expected.push({conversationId:'c' + n,requestTurnId:'q' + j,responseTurnId:'a' + j,category,classification:id === 'prepared' || i === 5 ? 'protective' : 'risky',evidence:response});
    }
    conversations.push({id:'c' + n,contactAlias:['Contact A','Contact B','Contact C'][n],timestamp:new Date(now.getTime() - (n + 1) * 86400000).toISOString(),turns});
  }
  conversations.push({id:'benign',contactAlias:'Contact D',timestamp:new Date(now.getTime()-86400000).toISOString(),turns:[
    {id:'q',speaker:'contact',text:'Keep the surprise party secret until Saturday.'},
    {id:'a',speaker:'user',text:'Of course! I will bring the cake.'},
  ]});
  return {id,windowStart:new Date(now.getTime()-30*86400000).toISOString(),windowEnd:now.toISOString(),conversations,expected};
}
export const messageSamples = [
  {name:'Delivery text',sender:'+1 (555) 016-3318',text:'Your delivery is on hold. Pay a small fee within ten minutes: https://delivery.example@192.0.2.1/pay'},
  {name:'Bank code request',sender:'+1 (555) 014-7731',text:'Bank Security: Your account is suspended. Send your verification code to restore access.'},
  {name:'Bank link, new sender',sender:'+1 (555) 014-9902',text:'Bank Security: Your account is suspended. Verify now at https://secure-bank-verify.example/login to restore access.'},
  {name:'Family emergency text',sender:'+1 (555) 019-8804',text:'Mom, it’s me. I lost my phone and this is my new number. I’m in trouble and need $500 for a lawyer right away. Please don’t tell Dad.'},
  {name:'One-time code request',sender:'+1 (555) 014-6650',text:'We stopped an unauthorized transfer from your account. Reply with the 6-digit code we just sent you to cancel it.'},
  {name:'Romance pressure',sender:'+1 (555) 018-2207',text:'My love, we have never met but you are all I have. Send gift cards for my emergency and do not tell anyone.'},
  {name:'Urgent but genuine',sender:'Pharmacy',text:'Reminder: your prescription is ready and will be returned to stock if not picked up by 6pm today. Questions? Call the number on your prescription label.'},
  {name:'Vague message',sender:'+1 (555) 017-5521',text:'Hey, it has been a while! Is this still your number?'},
  {name:'An ordinary message',sender:'Dental office',text:'Hi! Your appointment is tomorrow at 2pm. Please call the number on your appointment card if you need to reschedule.'},
];
