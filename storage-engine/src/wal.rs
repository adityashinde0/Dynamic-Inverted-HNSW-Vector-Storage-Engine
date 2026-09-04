use crate::types::{VectorId, VectorItem};
use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use crc32fast::Hasher;
use std::fs::{File, OpenOptions};
use std::io::{self, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

pub const WAL_MAGIC: &[u8; 4] = b"VWAL";
pub const WAL_VERSION: u16 = 1;
pub const OP_PUT: u8 = 1;

#[derive(Debug, Clone)]
pub struct WalRecord {
    pub seq_no: u64,
    pub op_type: u8,
    pub id: VectorId,
    pub values: Vec<f32>,
}

pub struct WalWriter {
    file_path: PathBuf,
    writer: BufWriter<File>,
    current_seq_no: u64,
    bytes_written: u64,
}

impl WalWriter {
    pub fn open<P: AsRef<Path>>(path: P, start_seq_no: u64) -> io::Result<Self> {
        let path = path.as_ref().to_path_buf();
        let file_exists = path.exists() && std::fs::metadata(&path)?.len() > 0;

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;

        let mut bytes_written = file.metadata()?.len();
        let mut writer = BufWriter::with_capacity(256 * 1024, file);

        if !file_exists {
            writer.write_all(WAL_MAGIC)?;
            writer.write_u16::<LittleEndian>(WAL_VERSION)?;
            writer.flush()?;
            bytes_written += 6;
        }

        Ok(Self {
            file_path: path,
            writer,
            current_seq_no: start_seq_no,
            bytes_written,
        })
    }

    pub fn append(&mut self, id: VectorId, values: &[f32]) -> io::Result<u64> {
        self.current_seq_no += 1;
        let seq = self.current_seq_no;
        let dim = values.len() as u32;

        let mut hasher = Hasher::new();
        hasher.update(&seq.to_le_bytes());
        hasher.update(&[OP_PUT]);
        hasher.update(&id.to_le_bytes());
        hasher.update(&dim.to_le_bytes());
        for v in values {
            hasher.update(&v.to_le_bytes());
        }
        let crc = hasher.finalize();

        self.writer.write_u64::<LittleEndian>(seq)?;
        self.writer.write_u8(OP_PUT)?;
        self.writer.write_u64::<LittleEndian>(id)?;
        self.writer.write_u32::<LittleEndian>(dim)?;
        for v in values {
            self.writer.write_f32::<LittleEndian>(*v)?;
        }
        self.writer.write_u32::<LittleEndian>(crc)?;

        let record_size = 8 + 1 + 8 + 4 + (dim as u64 * 4) + 4;
        self.bytes_written += record_size;

        Ok(seq)
    }

    pub fn append_batch(&mut self, items: &[VectorItem]) -> io::Result<u64> {
        let mut last_seq = self.current_seq_no;
        for item in items {
            last_seq = self.append(item.id, &item.values)?;
        }
        self.flush()?;
        Ok(last_seq)
    }

    pub fn flush(&mut self) -> io::Result<()> {
        self.writer.flush()
    }

    pub fn sync(&mut self) -> io::Result<()> {
        self.writer.flush()?;
        self.writer.get_ref().sync_all()
    }

    pub fn current_seq_no(&self) -> u64 {
        self.current_seq_no
    }

    pub fn bytes_written(&self) -> u64 {
        self.bytes_written
    }
}

pub struct WalReader;

impl WalReader {
    pub fn read_all<P: AsRef<Path>>(path: P) -> io::Result<Vec<WalRecord>> {
        let path = path.as_ref();
        if !path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(path)?;
        let mut reader = BufReader::new(file);

        let mut magic = [0u8; 4];
        if reader.read_exact(&mut magic).is_err() || &magic != WAL_MAGIC {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "Invalid WAL magic"));
        }

        let version = reader.read_u16::<LittleEndian>()?;
        if version != WAL_VERSION {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("Unsupported WAL version {}", version),
            ));
        }

        let mut records = Vec::new();

        loop {
            let seq = match reader.read_u64::<LittleEndian>() {
                Ok(s) => s,
                Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => break,
                Err(e) => return Err(e),
            };

            let op_type = reader.read_u8()?;
            let id = reader.read_u64::<LittleEndian>()?;
            let dim = reader.read_u32::<LittleEndian>()? as usize;

            let mut values = Vec::with_capacity(dim);
            let mut hasher = Hasher::new();
            hasher.update(&seq.to_le_bytes());
            hasher.update(&[op_type]);
            hasher.update(&id.to_le_bytes());
            hasher.update(&(dim as u32).to_le_bytes());

            for _ in 0..dim {
                let v = reader.read_f32::<LittleEndian>()?;
                hasher.update(&v.to_le_bytes());
                values.push(v);
            }

            let expected_crc = reader.read_u32::<LittleEndian>()?;
            let computed_crc = hasher.finalize();

            if expected_crc != computed_crc {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("WAL CRC mismatch at seq {}: expected {:x}, got {:x}", seq, expected_crc, computed_crc),
                ));
            }

            records.push(WalRecord {
                seq_no: seq,
                op_type,
                id,
                values,
            });
        }

        Ok(records)
    }
}
