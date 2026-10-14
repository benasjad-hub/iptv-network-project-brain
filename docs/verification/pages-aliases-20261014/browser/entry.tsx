import React from 'react';
import {createRoot} from 'react-dom/client';
import {StudioSitePageCards} from '../../apps/panel/components/StudioSitePageCards';
const w=window as any;w.__pageQa={calls:[],routes:[],mode:'error',resolve:null};
createRoot(document.getElementById('root')!).render(<StudioSitePageCards site={w.__pagesFixture.site} pages={w.__pagesFixture.pages} trustedAliases={w.__pagesFixture.trustedAliases}/>);
