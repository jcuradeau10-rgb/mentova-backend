"""
Local in-memory database that mimics MongoDB motor async interface.
Used as fallback when MongoDB Atlas is unavailable (IP restrictions on Render).
"""
import json
import os
import logging
from datetime import datetime, timezone
from bson import ObjectId

logger = logging.getLogger("local_db")

DATA_DIR = os.path.join(os.path.dirname(__file__), "db_data")
os.makedirs(DATA_DIR, exist_ok=True)


class LocalCollection:
    def __init__(self, name):
        self.name = name
        self._data = []
        self._load()

    def _file(self):
        return os.path.join(DATA_DIR, f"{self.name}.json")

    def _load(self):
        try:
            if os.path.exists(self._file()):
                with open(self._file(), "r") as f:
                    self._data = json.load(f)
                logger.info(f"Loaded {len(self._data)} docs from {self.name}")
        except Exception as e:
            logger.error(f"Error loading {self.name}: {e}")
            self._data = []

    def _save(self):
        try:
            with open(self._file(), "w") as f:
                json.dump(self._data, f, default=str)
        except Exception as e:
            logger.error(f"Error saving {self.name}: {e}")

    async def find_one(self, filter=None, sort=None):
        results = self._match(filter or {})
        if sort:
            for key, direction in reversed(sort if isinstance(sort, list) else [sort]):
                results.sort(key=lambda x: x.get(key, ""), reverse=(direction == -1))
        return results[0] if results else None

    def find(self, filter=None, sort=None):
        return LocalCursor(self._match(filter or {}), sort)

    async def count_documents(self, filter=None):
        return len(self._match(filter or {}))

    async def insert_one(self, doc):
        doc = dict(doc)
        if "_id" not in doc:
            doc["_id"] = str(ObjectId())
        self._data.append(doc)
        self._save()
        return type("Result", (), {"inserted_id": doc["_id"]})()

    async def update_one(self, filter, update):
        for doc in self._data:
            if self._matches(doc, filter):
                if "$set" in update:
                    doc.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        doc[k] = doc.get(k, 0) + v
                if "$push" in update:
                    for k, v in update["$push"].items():
                        if k not in doc:
                            doc[k] = []
                        doc[k].append(v)
                self._save()
                return type("Result", (), {"modified_count": 1})()
        return type("Result", (), {"modified_count": 0})()

    async def update_many(self, filter, update):
        count = 0
        for doc in self._data:
            if self._matches(doc, filter):
                if "$set" in update:
                    doc.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        doc[k] = doc.get(k, 0) + v
                count += 1
        if count:
            self._save()
        return type("Result", (), {"modified_count": count})()

    async def delete_one(self, filter):
        for i, doc in enumerate(self._data):
            if self._matches(doc, filter):
                self._data.pop(i)
                self._save()
                return type("Result", (), {"deleted_count": 1})()
        return type("Result", (), {"deleted_count": 0})()

    async def delete_many(self, filter):
        before = len(self._data)
        self._data = [d for d in self._data if not self._matches(d, filter)]
        self._save()
        return type("Result", (), {"deleted_count": before - len(self._data)})()

    def _match(self, filter):
        if not filter:
            return list(self._data)
        return [d for d in self._data if self._matches(d, filter)]

    def _matches(self, doc, filter):
        for k, v in filter.items():
            if k == "$or":
                if not any(self._matches(doc, cond) for cond in v):
                    return False
                continue
            if k == "$and":
                if not all(self._matches(doc, cond) for cond in v):
                    return False
                continue
            doc_val = doc.get(k)
            if isinstance(v, dict):
                for op, op_val in v.items():
                    if op == "$gt" and not (doc_val and doc_val > op_val):
                        return False
                    if op == "$gte" and not (doc_val and doc_val >= op_val):
                        return False
                    if op == "$lt" and not (doc_val and doc_val < op_val):
                        return False
                    if op == "$in" and doc_val not in op_val:
                        return False
                    if op == "$ne" and doc_val == op_val:
                        return False
                    if op == "$exists" and (op_val and k not in doc) or (not op_val and k in doc):
                        return False
                    if op == "$regex":
                        import re
                        flags = v.get("$options", "")
                        rf = re.IGNORECASE if "i" in flags else 0
                        if not doc_val or not re.search(op_val, str(doc_val), rf):
                            return False
            elif isinstance(v, ObjectId):
                if str(doc_val) != str(v):
                    return False
            else:
                if str(doc_val) != str(v) and doc_val != v:
                    return False
        return True


class LocalCursor:
    def __init__(self, data, sort=None):
        self._data = data
        if sort:
            if isinstance(sort, list):
                for key, direction in reversed(sort):
                    self._data.sort(key=lambda x: x.get(key, ""), reverse=(direction == -1))
            elif isinstance(sort, tuple):
                self._data.sort(key=lambda x: x.get(sort[0], ""), reverse=(sort[1] == -1))

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, str):
            self._data.sort(key=lambda x: x.get(key_or_list, ""), reverse=(direction == -1))
        elif isinstance(key_or_list, list):
            for key, d in reversed(key_or_list):
                self._data.sort(key=lambda x: x.get(key, ""), reverse=(d == -1))
        return self

    def skip(self, n):
        self._data = self._data[n:]
        return self

    def limit(self, n):
        self._data = self._data[:n]
        return self

    def __aiter__(self):
        self._iter = iter(self._data)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration

    async def to_list(self, length=None):
        if length:
            return self._data[:length]
        return self._data


class LocalDatabase:
    def __init__(self):
        self._collections = {}

    def __getattr__(self, name):
        if name.startswith("_"):
            return super().__getattribute__(name)
        if name not in self._collections:
            self._collections[name] = LocalCollection(name)
        return self._collections[name]


def get_local_db():
    return LocalDatabase()
