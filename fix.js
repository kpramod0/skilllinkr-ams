const fs = require('fs');
const file = 'c:/UNIQUE/Work/annnn/skilllinkr-ams/src/app/ams/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<label className="text-xs font-bold text-\[#6b6b80\] uppercase tracking-wider">Institution Domain<\/label>[\s\S]*?<input[\s\S]*?\/>/;

const replacement = `<label className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Institution</label>
                        <select 
                          required
                          value={inviteDomain}
                          onChange={(e) => setInviteDomain(e.target.value)}
                          className="w-full bg-[#ffffff] border border-[#d4d4dc] rounded-xl px-3 py-2.5 text-sm focus:border-[#10b981] focus:ring-1 focus:ring-teal-500 outline-none transition-shadow"
                        >
                          <option value="" disabled>Select an institution</option>
                          {institutions.map(i => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                        </select>`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed page.tsx');