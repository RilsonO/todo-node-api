import { Database } from './database.js';
import { randomUUID } from 'node:crypto';
import { buildRoutePath } from './utils/build-route-path.js';
import multer from 'multer';
import csvParser from 'csv-parser';
import fs from 'node:fs';
import { json } from './middlewares/json.js';

const database = new Database();

export const routes = [
  {
    method: 'POST',
    path: buildRoutePath('/tasks'),
    handler: async (req, res) => {
      await json(req, res);

      const { title, description } = req.body;

      if (!title) {
        return res
          .writeHead(400)
          .end(JSON.stringify({ message: 'title is required.' }));
      }

      if (!description) {
        return res
          .writeHead(400)
          .end(JSON.stringify({ message: 'description is required.' }));
      }

      const task = {
        id: randomUUID(),
        title,
        description,
        completed_at: null,
        created_at: new Date(),
        updated_at: null,
      };

      database.insert('tasks', task);

      return res.writeHead(201).end();
    },
  },
  {
    method: 'POST',
    path: buildRoutePath('/tasks/upload'),
    handler: async (req, res) => {
      res.setHeader('Content-type', 'multipart/form-data');

      // Verifica se a pasta 'temp' existe e cria, se necessário
      const tempFolderPath = 'temp';
      if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
      }

      const storage = multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, 'temp/');
        },
        filename: (req, file, cb) => {
          // Exclui o arquivo 'tasks_temp.csv' anterior, se existir
          const filePath = 'temp/tasks_temp.csv';
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          const newFileName = `tasks_temp.csv`;
          cb(null, newFileName);
        },
      });

      const upload = multer({ storage });

      upload.single('tasks')(req, res, (err) => {
        if (err) {
          console.error(err);
          return res.writeHead(500).end('Internal Server Error');
        }

        const { path: tempFilePath } = req.file;

        // Processa o arquivo CSV
        const tasks = [];
        fs.createReadStream(tempFilePath)
          .pipe(csvParser())
          .on('data', (data) => {
            tasks.push(data);
          })
          .on('end', () => {
            tasks.forEach(({ title, description }) => {
              if (title && description) {
                const task = {
                  id: randomUUID(),
                  title,
                  description,
                  completed_at: null,
                  created_at: new Date(),
                  updated_at: null,
                };

                database.insert('tasks', task);
              }
            });
          });
      });

      return res.writeHead(201).end('File uploaded and processed successfully');
    },
  },
  {
    method: 'GET',
    path: buildRoutePath('/tasks'),
    handler: async (req, res) => {
      await json(req, res);

      const { search } = req.query;

      const tasks = database.select(
        'tasks',
        search
          ? {
              title: search,
              description: search,
            }
          : null
      );

      return res.end(JSON.stringify(tasks));
    },
  },
  {
    method: 'PUT',
    path: buildRoutePath('/tasks/:id'),
    handler: async (req, res) => {
      await json(req, res);

      const { id } = req.params;
      const { title, description } = req.body;

      if (!title || !description) {
        return res
          .writeHead(400)
          .end(
            JSON.stringify({ message: 'title and description are required' })
          );
      }

      if (database.findById('tasks', id).length <= 0) {
        return res
          .writeHead(404)
          .end(JSON.stringify({ error: 'Task not found.' }));
      }

      database.update('tasks', id, {
        title,
        description,
      });

      return res.writeHead(204).end();
    },
  },
  {
    method: 'DELETE',
    path: buildRoutePath('/tasks/:id'),
    handler: async (req, res) => {
      await json(req, res);

      const { id } = req.params;

      if (database.findById('tasks', id).length <= 0) {
        return res
          .writeHead(404)
          .end(JSON.stringify({ error: 'Task not found.' }));
      }

      database.delete('tasks', id);

      return res.writeHead(204).end();
    },
  },
  {
    method: 'PATCH',
    path: buildRoutePath('/tasks/:id/complete'),
    handler: async (req, res) => {
      await json(req, res);

      const { id } = req.params;

      if (database.findById('tasks', id).length <= 0) {
        return res
          .writeHead(404)
          .end(JSON.stringify({ error: 'Task not found.' }));
      }

      database.complete('tasks', id);

      return res.writeHead(204).end();
    },
  },
];
