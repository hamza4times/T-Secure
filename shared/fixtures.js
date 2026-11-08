// All people, conversations, and annotations in this file are synthetic.
// 555-01xx numbers are reserved for fiction.
export const scenarios = [
  {id:'family',name:'Scenario A · A family emergency',description:'Someone says “it’s me” and needs help fast. Watch how the request develops.',caller:'Unknown caller',claim:'Says they are your grandson',number:'+1 (555) 019-8804',initials:'?',duration:'40 sec',turns:[
    ['contact','Hey, it\'s me. I\'m in serious trouble.'],
    ['user','Tommy? Is that you? What\'s wrong?'],
    ['contact','I got arrested, and I need your help.'],
    ['user','Arrested? Oh no. What happened?'],
    ['contact','I need money immediately.'],
    ['user','How much do you need?'],
    ['contact','Please don\'t tell anyone.'],
    ['user','I don\'t understand. Why can\'t I tell anyone?'],
    ['contact','Can you send the money right now?'],
  ]},
  {id:'legitimate',name:'Scenario C · An urgent but genuine call',description:'A real family emergency sounds urgent too. No money, no secrecy, and the caller invites a callback.',caller:'Sarah · sample contact',claim:'Saved contact: your daughter',number:'+1 (555) 017-3020',initials:'S',duration:'30 sec',turns:[
    ['contact','Hi Mom, it\'s Sarah. Dad slipped on the ice and we\'re at the hospital.'],
    ['user','Oh no! Is he all right?'],
    ['contact','He\'s okay, just a sprained wrist. Can you come right away and drive his car home?'],
    ['user','Of course. Which hospital?'],
    ['contact','St. Mary\'s on Fifth Street. Call me back on my cell if you can\'t find it.'],
    ['user','I\'m leaving now.'],
  ]},
  {id:'grandchild',name:'A grandchild “from a friend’s phone”',description:'Someone sounds familiar. Their request needs a second look.',caller:'Unknown caller',claim:'Says they are your grandson',number:'+1 (555) 019-8804',initials:'?',duration:'35 sec',turns:[
    ['contact','Hi Grandma, it is your grandson. My phone broke, so I am calling from a friend’s number.'],
    ['user','Are you all right? You sound upset.'],
    ['contact','I am in trouble and need your help. Please do not tell anyone.'],
    ['user','What happened?'],
    ['contact','I need you to buy gift cards and send me the codes now. It is an emergency.'],
    ['user','I need a moment to think.'],
    ['contact','Do not call my parents. Just send the money before they find out.'],
  ]},
  {id:'bank',name:'The “bank security” call',description:'An urgent transfer to a supposed safe account.',caller:'Bank security (unverified)',claim:'Says they are your bank',number:'+1 (555) 014-2290',initials:'B',duration:'30 sec',turns:[
    ['contact','This is the security department at your bank. We noticed unusual activity.'],
    ['user','How can I check that you are from my bank?'],
    ['contact','Your account will be frozen within ten minutes.'],
    ['contact','Move your savings into a safe account that I will give you.'],
    ['contact','Read me your verification code so I can protect your account.'],
  ]},
  {id:'government',name:'A government impostor',description:'A demand for immediate payment to avoid arrest.',caller:'Agency representative (unverified)',claim:'Says they are a tax office',number:'+1 (555) 012-1176',initials:'G',duration:'25 sec',turns:[
    ['contact','I am calling from the federal tax office.'],
    ['contact','There is a warrant for your arrest unless you settle your debt.'],
    ['user','Can you send me a written notice?'],
    ['contact','You must pay with bitcoin within five minutes.'],
  ]},
  {id:'support',name:'An unexpected support call',description:'A caller wants control of your computer.',caller:'Technical support (unverified)',claim:'Says they are tech support',number:'+1 (555) 013-4452',initials:'T',duration:'25 sec',turns:[
    ['contact','We have detected a problem on your computer.'],
    ['user','I did not request technical support.'],
    ['contact','Download AnyDesk and enable remote access so I can fix it.'],
    ['contact','Then send your password so I can finish the repair.'],
  ]},
  {id:'checkin',name:'A regular check-in',description:'A familiar conversation without risky requests.',caller:'Jamie · sample contact',claim:'Saved contact: a friend',number:'+1 (555) 017-3021',initials:'J',duration:'25 sec',turns:[
    ['contact','Hi! Are we still meeting for lunch tomorrow?'],
    ['user','Yes, I am looking forward to it.'],
    ['contact','Let us meet at noon. You can call me back on my usual number.'],
    ['user','Perfect, see you then.'],
  ]},
];
export const messageSamples = [
  {name:'Scenario B · Bank suspension',sender:'+1 (555) 014-9902',text:'URGENT: Your bank account has been suspended. Verify your identity immediately using this link.'},
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
