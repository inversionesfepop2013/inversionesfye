const {getConfig,getServiceKey,readInvestorSession,sendJson}=require('../lib/admin-auth');
module.exports=async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return sendJson(res,405,{error:'Método no permitido.'});}
  const session=await readInvestorSession(req,res).catch(()=>({ok:false,status:503,message:'No se pudo comprobar la sesión.'}));
  if(!session.ok)return sendJson(res,session.status,{error:session.message});
  const config=getConfig(),key=getServiceKey();
  const headers={apikey:key,Authorization:'Bearer '+key};
  const fields='account_id,currency_code,product_name,monthly_rate,monthly_rate_cap,withholding_rate,payout_day,invested_capital,available_net_profit,gross_profit_total,tax_withheld_total,profit_withdrawn_total,monthly_gross_profit_cap,estimated_monthly_withholding,monthly_net_withdrawal_cap,status';
  const url=config.url+'/rest/v1/fye_investor_account_summary?owner_profile_id=eq.'+encodeURIComponent(session.profile.id)+'&status=eq.active&select='+fields+'&order=opened_on.desc';
  const response=await fetch(url,{headers}).catch(()=>null);
  if(!response||!response.ok)return sendJson(res,503,{error:'No se pudo cargar el resumen de inversiones.'});
  const accounts=await response.json().catch(()=>null);
  if(!Array.isArray(accounts))return sendJson(res,503,{error:'El resumen devuelto no es válido.'});
  let entries=[];
  if(accounts.length){
    const ids=accounts.map(a=>a.account_id).filter(id=>/^[0-9a-f-]{36}$/i.test(String(id)));
    if(ids.length){
      const list='('+ids.join(',')+')';
      const historyUrl=config.url+'/rest/v1/ledger_entries?account_id=in.'+encodeURIComponent(list)+'&select=account_id,entry_type,amount,currency_code,period_month,description,created_at&order=created_at.desc&limit=50';
      const history=await fetch(historyUrl,{headers}).catch(()=>null);
      if(history&&history.ok){const rows=await history.json().catch(()=>[]);if(Array.isArray(rows))entries=rows;}
    }
  }
  return sendJson(res,200,{name:session.profile.full_name||session.user.email,accounts,entries,payoutDay:5,monthlyCap:0.03,withholdingRate:0.18,payoutPeriodConfirmed:false});
};
