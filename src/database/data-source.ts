import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  getEnvironmentPort,
  getRequiredEnvironment,
} from '../config/environment';
import { Oficial } from '../oficial/entities/oficial.entity';
import { Escala } from '../escala/entities/escala.entity';
import { Servico } from '../servico/entities/servico.entity';
import { FilaEscolha } from '../fila-escolha/entities/fila-escolha.entity';
import { Permuta } from '../permuta/entities/permuta.entity';
import { Unidade } from '../unidade/entities/unidade.entity';
import { AddGrupoTrocaToPermutas1789344000000 } from '../migrations/202609140001-add-grupo-troca-to-permutas';
import { AddIntegrityConstraints1789862400000 } from '../migrations/202609200001-add-integrity-constraints';
import { AddDataPromocaoOficiais1789866000000 } from '../migrations/202609200002-add-data-promocao-oficiais';
import { AddAdminMasterRole1789869600000 } from '../migrations/202609200003-add-admin-master-role';
import { CreateUnidades1790035200000 } from '../migrations/202609220001-create-unidades';
import { AddJustificativaInaptidao1790038800000 } from '../migrations/202609220002-add-justificativa-inaptidao';
import { AddTrocaSenhaObrigatoria1790042400000 } from '../migrations/202609220003-add-troca-senha-obrigatoria';
import { AddVersaoAutenticacao1790046000000 } from '../migrations/202609220004-add-versao-autenticacao';
import { AuditoriaEvento } from '../auditoria/entities/auditoria-evento.entity';
import { CreateAuditoriaEventos1790049600000 } from '../migrations/202609220005-create-auditoria-eventos';

export default new DataSource({
  type: 'mysql',
  host: getRequiredEnvironment('DB_HOST'),
  port: getEnvironmentPort('DB_PORT'),
  username: getRequiredEnvironment('DB_USERNAME'),
  password: getRequiredEnvironment('DB_PASSWORD'),
  database: getRequiredEnvironment('DB_DATABASE'),
  entities: [
    Oficial,
    Escala,
    Servico,
    FilaEscolha,
    Permuta,
    Unidade,
    AuditoriaEvento,
  ],
  migrations: [
    AddGrupoTrocaToPermutas1789344000000,
    AddIntegrityConstraints1789862400000,
    AddDataPromocaoOficiais1789866000000,
    AddAdminMasterRole1789869600000,
    CreateUnidades1790035200000,
    AddJustificativaInaptidao1790038800000,
    AddTrocaSenhaObrigatoria1790042400000,
    AddVersaoAutenticacao1790046000000,
    CreateAuditoriaEventos1790049600000,
  ],
  synchronize: false,
  migrationsRun: false,
});
